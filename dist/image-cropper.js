(() => {
  const createError = message => Object.assign(new Error(message), { name: 'ImageCropCancelled' });

  function buildDialog() {
    const dialog = document.createElement('dialog');
    dialog.className = 'image-cropper';
    dialog.innerHTML = `
      <form class="cropper-panel" method="dialog">
        <div class="cropper-heading"><div><p class="cropper-eyebrow">Photo crop</p><h2>Choose the best bit</h2><p>Drag the photo to position it, then use the slider to zoom.</p></div><button class="cropper-close" value="cancel" type="submit" aria-label="Cancel cropping">×</button></div>
        <div class="cropper-frame"><img alt="Photo crop preview"></div>
        <label class="cropper-shape">Crop shape<select><option value="1">Square</option><option value="1.3333333333">Landscape</option><option value="0.75">Portrait</option><option value="original">Original shape</option></select></label>
        <label class="cropper-zoom">Zoom<input type="range" min="1" max="3" step="0.01" value="1"></label>
        <div class="cropper-actions"><button class="cropper-cancel" value="cancel" type="submit">Cancel</button><button class="cropper-use" value="default" type="button">Use cropped photo</button></div>
      </form>`;
    document.body.append(dialog);
    return dialog;
  }

  function cropImage(file) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith('image/')) { reject(new Error('Please choose an image file.')); return; }
      const dialog = buildDialog();
      const frame = dialog.querySelector('.cropper-frame');
      const image = dialog.querySelector('img');
      const shape = dialog.querySelector('select');
      const zoom = dialog.querySelector('input[type="range"]');
      const useButton = dialog.querySelector('.cropper-use');
      let scale = 1;
      let offsetX = 0;
      let offsetY = 0;
      let dragging = false;
      let lastPoint = null;
      let objectUrl = '';
      let completed = false;

      const cleanUp = () => { if (objectUrl) URL.revokeObjectURL(objectUrl); dialog.remove(); };
      const dimensions = () => ({ width: frame.clientWidth, height: frame.clientHeight });
      const applyShape = () => { const ratio = shape.value === 'original' ? image.naturalWidth / image.naturalHeight : Number(shape.value); frame.style.aspectRatio = String(ratio); };
      const limit = () => {
        const { width, height } = dimensions();
        offsetX = Math.min(0, Math.max(width - image.naturalWidth * scale, offsetX));
        offsetY = Math.min(0, Math.max(height - image.naturalHeight * scale, offsetY));
      };
      const paint = () => {
        limit();
        image.style.width = `${image.naturalWidth * scale}px`;
        image.style.height = `${image.naturalHeight * scale}px`;
        image.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
      };
      const initialise = () => {
        const { width, height } = dimensions();
        scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
        offsetX = (width - image.naturalWidth * scale) / 2;
        offsetY = (height - image.naturalHeight * scale) / 2;
        zoom.value = '1';
        paint();
      };
      const finish = () => {
        const { width, height } = dimensions();
        const cropWidth = width / scale;
        const cropHeight = height / scale;
        const sourceX = Math.max(0, -offsetX / scale);
        const sourceY = Math.max(0, -offsetY / scale);
        const outputSize = Math.min(1600, Math.max(720, Math.round(Math.max(cropWidth, cropHeight))));
        const outputScale = outputSize / Math.max(cropWidth, cropHeight);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(cropWidth * outputScale);
        canvas.height = Math.round(cropHeight * outputScale);
        canvas.getContext('2d').drawImage(image, sourceX, sourceY, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => {
          if (!blob) { reject(new Error('The cropped photo could not be created.')); cleanUp(); return; }
          const baseName = file.name.replace(/\.[^/.]+$/, '') || 'photo';
          completed = true;
          cleanUp();
          resolve(new File([blob], `${baseName}-cropped.jpg`, { type: 'image/jpeg' }));
        }, 'image/jpeg', .9);
      };

      zoom.addEventListener('input', () => {
        const { width, height } = dimensions();
        const oldScale = scale;
        const oldCentreX = (width / 2 - offsetX) / oldScale;
        const oldCentreY = (height / 2 - offsetY) / oldScale;
        const baseScale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
        scale = baseScale * Number(zoom.value);
        offsetX = width / 2 - oldCentreX * scale;
        offsetY = height / 2 - oldCentreY * scale;
        paint();
      });
      shape.addEventListener('change', () => { applyShape(); requestAnimationFrame(initialise); });
      frame.addEventListener('pointerdown', event => { dragging = true; lastPoint = event; frame.setPointerCapture(event.pointerId); });
      frame.addEventListener('pointermove', event => {
        if (!dragging || !lastPoint) return;
        offsetX += event.clientX - lastPoint.clientX;
        offsetY += event.clientY - lastPoint.clientY;
        lastPoint = event;
        paint();
      });
      frame.addEventListener('pointerup', () => { dragging = false; lastPoint = null; });
      frame.addEventListener('pointercancel', () => { dragging = false; lastPoint = null; });
      useButton.addEventListener('click', finish);
      dialog.addEventListener('close', () => { if (!completed) { cleanUp(); reject(createError('Cropping cancelled.')); } }, { once: true });

      objectUrl = URL.createObjectURL(file);
      image.addEventListener('load', () => { dialog.showModal(); applyShape(); requestAnimationFrame(initialise); }, { once: true });
      image.src = objectUrl;
    });
  }

  window.CookiesCakesImageCropper = { cropImage };
})();
