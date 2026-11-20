const bwrPalette = [
  [0, 0, 0, 255],
  [255, 255, 255, 255],
  [255, 0, 0, 255]
]

const bwPalette = [
  [0, 0, 0, 255],
  [255, 255, 255, 255],
]

function dithering(ctx, width, height, threshold, type) {
  const bayerThresholdMap = [
    [  15, 135,  45, 165 ],
    [ 195,  75, 225, 105 ],
    [  60, 180,  30, 150 ],
    [ 240, 120, 210,  90 ]
  ];

  const lumR = [];
  const lumG = [];
  const lumB = [];
  for (let i=0; i<256; i++) {
    lumR[i] = i*0.299;
    lumG[i] = i*0.587;
    lumB[i] = i*0.114;
  }
  const imageData = ctx.getImageData(0, 0, width, height);

  const imageDataLength = imageData.data.length;

  // Greyscale luminance (sets r pixels to luminance of rgb)
  for (let i = 0; i <= imageDataLength; i += 4) {
    imageData.data[i] = Math.floor(lumR[imageData.data[i]] + lumG[imageData.data[i+1]] + lumB[imageData.data[i+2]]);
  }

  const w = imageData.width;
  let newPixel, err;

  for (let currentPixel = 0; currentPixel <= imageDataLength; currentPixel+=4) {
    if (type === "gray") {
      const factor = 255 / (threshold - 1);
      imageData.data[currentPixel] = Math.round(imageData.data[currentPixel] / factor) * factor;
    } else if (type ==="none") {
      // No dithering
      imageData.data[currentPixel] = imageData.data[currentPixel] < threshold ? 0 : 255;
    } else if (type ==="bayer") {
      // 4x4 Bayer ordered dithering algorithm
      var x = currentPixel/4 % w;
      var y = Math.floor(currentPixel/4 / w);
      var map = Math.floor( (imageData.data[currentPixel] + bayerThresholdMap[x%4][y%4]) / 2 );
      imageData.data[currentPixel] = (map < threshold) ? 0 : 255;
    } else if (type ==="floydsteinberg") {
      // Floyda€"Steinberg dithering algorithm
      newPixel = imageData.data[currentPixel] < 129 ? 0 : 255;
      err = Math.floor((imageData.data[currentPixel] - newPixel) / 16);
      imageData.data[currentPixel] = newPixel;

      imageData.data[currentPixel       + 4 ] += err*7;
      imageData.data[currentPixel + 4*w - 4 ] += err*3;
      imageData.data[currentPixel + 4*w     ] += err*5;
      imageData.data[currentPixel + 4*w + 4 ] += err*1;
    } else {
      // Bill Atkinson's dithering algorithm
      newPixel = imageData.data[currentPixel] < threshold ? 0 : 255;
      err = Math.floor((imageData.data[currentPixel] - newPixel) / 8);
      imageData.data[currentPixel] = newPixel;

      imageData.data[currentPixel       + 4 ] += err;
      imageData.data[currentPixel       + 8 ] += err;
      imageData.data[currentPixel + 4*w - 4 ] += err;
      imageData.data[currentPixel + 4*w     ] += err;
      imageData.data[currentPixel + 4*w + 4 ] += err;
      imageData.data[currentPixel + 8*w     ] += err;
    }

    // Set g and b pixels equal to r
    imageData.data[currentPixel + 1] = imageData.data[currentPixel + 2] = imageData.data[currentPixel];
  }

  ctx.putImageData(imageData, 0, 0);
}

// white: 1, black/red: 0
function canvas2bytes(canvas, step = 'bw', invert = false) {
  const ctx = canvas.getContext("2d");
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const arr = [];
  let buffer = [];

  // 假设硬件期望的输出尺寸是 128x250
  const outputWidth = 128;
  const outputHeight = 250;

  for (let y_out = 0; y_out < outputHeight; y_out++) { // 遍历输出的行 (0 to 249)
    for (let x_out = 0; x_out < outputWidth; x_out++) { // 遍历输出的列 (0 to 127)
      // 计算在原始横屏 canvas 上的对应坐标
      // 逆时针旋转90度：新的x = 旧的y, 新的y = canvas.width - 1 - 旧的x
      // 所以，原始的 x_canvas = canvas.width - 1 - y_out
      // 原始的 y_canvas = x_out
      const x_canvas = canvas.width - 1 - y_out;
      const y_canvas = x_out;

      let pixelValue;
      // 检查坐标是否在 canvas 范围内，如果超出，则视为白色
      if (x_canvas >= 0 && x_canvas < canvas.width && y_canvas >= 0 && y_canvas < canvas.height) {
        const i = (canvas.width * y_canvas + x_canvas) * 4;
        if (step === 'bw') {
          // 对于黑白模式，检查是否为黑色
          pixelValue = (imageData.data[i] === 0 && imageData.data[i+1] === 0 && imageData.data[i+2] === 0) ? 0 : 1;
        } else if (step === 'red') {
          // 对于红色模式，检查是否为红色
          // 这里的逻辑是当像素是红色（R值高，G和B值低）时，设为0
          pixelValue = (imageData.data[i] > 128 && imageData.data[i+1] < 128 && imageData.data[i+2] < 128) ? 0 : 1;
        } else if (step === 'bwr') {
          // 对于三色模式，检查是否为黑色
          pixelValue = (imageData.data[i] === 0 && imageData.data[i+1] === 0 && imageData.data[i+2] === 0) ? 0 : 1;
        } else {
          // 默认模式，适配所有算法
          // 如果像素接近黑色，则视为0，否则视为1
          const isBlack = (imageData.data[i] < 128 && imageData.data[i+1] < 128 && imageData.data[i+2] < 128);
          pixelValue = isBlack ? 0 : 1;
        }
      } else {
        // 超出 canvas 范围的像素，默认为白色
        pixelValue = 1;
      }

      buffer.push(pixelValue);

      if (buffer.length === 8) {
        const data = parseInt(buffer.join(''), 2);
        // 使用更安全的按位取反方式，确保结果是8位数据
        arr.push(invert ? (0xFF ^ data) : data);
        buffer = [];
      }
    }
  }
  return arr;
}

function getColorDistance(rgba1, rgba2) {
  const [r1, b1, g1] = rgba1;
  const [r2, b2, g2] = rgba2;

  const rm = (r1 + r2 ) / 2;

  const r = r1 - r2;
  const g = g1 - g2;
  const b = b1 - b2;

  return Math.sqrt((2 + rm / 256) * r * r + 4 * g * g + (2 + (255 - rm) / 256) * b * b);
}

function getNearColor(pixel, palette) {
  let minDistance = 255 * 255 * 3 + 1;
  let paletteIndex = 0;

  for (let i = 0; i < palette.length; i++) {
    const targetColor = palette[i];
    const distance = getColorDistance(pixel, targetColor);
    if (distance < minDistance) {
      minDistance = distance;
      paletteIndex = i;
    }
  }

  return palette[paletteIndex];
}


function getNearColorV2(color, palette) {
  let minDistanceSquared = 255*255 + 255*255 + 255*255 + 1;

  let bestIndex = 0;
  for (let i = 0; i < palette.length; i++) {
      let rdiff = (color[0] & 0xff) - (palette[i][0] & 0xff);
      let gdiff = (color[1] & 0xff) - (palette[i][1] & 0xff);
      let bdiff = (color[2] & 0xff) - (palette[i][2] & 0xff);
      let distanceSquared = rdiff*rdiff + gdiff*gdiff + bdiff*bdiff;
      if (distanceSquared < minDistanceSquared) {
          minDistanceSquared = distanceSquared;
          bestIndex = i;
      }
  }
  return palette[bestIndex];

}


function updatePixel(imageData, index, color) {
  imageData[index] = color[0];
  imageData[index+1] = color[1];
  imageData[index+2] = color[2];
  imageData[index+3] = color[3];
}

function getColorErr(color1, color2, rate) {
  const res = [];
  for (let i = 0; i < 3; i++) {
    res.push(Math.floor((color1[i] - color2[i]) / rate));
  }
  return res;
}

function updatePixelErr(imageData, index, err, rate) {
  imageData[index] += err[0] * rate;
  imageData[index+1] += err[1] * rate;
  imageData[index+2] += err[2] * rate;
}

function ditheringCanvasByPalette(canvas, palette, type) {
  palette = palette || bwrPalette;

  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const w = imageData.width;

  for (let currentPixel = 0; currentPixel <= imageData.data.length; currentPixel+=4) {
    const newColor = getNearColorV2(imageData.data.slice(currentPixel, currentPixel+4), palette);

    if (type === "bwr_floydsteinberg") {
      const err = getColorErr(imageData.data.slice(currentPixel, currentPixel+4), newColor, 16);

      updatePixel(imageData.data, currentPixel, newColor);
      updatePixelErr(imageData.data, currentPixel +4, err, 7);
      updatePixelErr(imageData.data, currentPixel + 4*w - 4, err, 3);
      updatePixelErr(imageData.data, currentPixel + 4*w, err, 5);
      updatePixelErr(imageData.data, currentPixel + 4*w + 4, err, 1);
    } else {
      const err = getColorErr(imageData.data.slice(currentPixel, currentPixel+4), newColor, 8);

      updatePixel(imageData.data, currentPixel, newColor);
      updatePixelErr(imageData.data, currentPixel +4, err, 1);
      updatePixelErr(imageData.data, currentPixel +8, err, 1);
      updatePixelErr(imageData.data, currentPixel +4 * w - 4, err, 1);
      updatePixelErr(imageData.data, currentPixel +4 * w, err, 1);
      updatePixelErr(imageData.data, currentPixel +4 * w + 4, err, 1);
      updatePixelErr(imageData.data, currentPixel +8 * w, err, 1);
    }
  }
  ctx.putImageData(imageData, 0, 0);
}