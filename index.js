import * as gameboy from './lib/index.ts';
import vgmURL1 from './vgmtest/friendly_battle.vgm'
import vgmURL2 from './vgmtest/title.vgm'

gameboy.allow();

document.body.addEventListener('mousedown', gameboy.allow);
document.body.addEventListener('touchstart', gameboy.allow);

gameboy.changeUserVolume(0.5);

function hit(note, beats) {
	return new Uint8Array([
		// duty DD, lenght? LLLLLL
		0xB3, 0x16-0x10, 0b10111111,
		// start volume VVVV, direction A (+/- =1/0), period PPP
		0xB3, 0x17-0x10, 0b11110001,
		// pitch low
		0xB3, 0x18-0x10, note&0xFF,
		// trigger 1, something? 0, --- pitch high HHH
		0xB3, 0x19-0x10, 0b10000000 + (note>>8),

		// duty DD, lenght? LLLLLL
		0xB3, 0x11-0x10, 0b11111111,
		// start volume VVVV, direction A (+/- =1/0), period PPP
		0xB3, 0x12-0x10, 0b10010001,
		// pitch low
		0xB3, 0x13-0x10, (note+10)&0xFF,
		// trigger 1, something? 0, --- pitch high HHH
		0xB3, 0x14-0x10, 0b10000000 + (note+10>>8),

		// enable channel
		0xB3, 0x1A-0x10, 0b10000000,
		// sound length
		0xB3, 0x1B-0x10, 0b11100000,
		// volume -vv-----
		0xB3, 0x1C-0x10, 0b00100000,

		0xB3, 0x1d-0x10, note&0xFF,
		// trigger 1, something? 0, --- pitch high HHH
		0xB3, 0x1e-0x10, 0b11000000 + (note>>8),


		// noise
		0xB3, 0x20-0x10, 0b00111111,
		0xB3, 0x21-0x10, 0b01110001,
		0xB3, 0x22-0x10, 0b00111111,
		0xB3, 0x23-0x10, 0b10000000,

		// wait
		0x61, (beats*2756)&0xFF, (beats*2756)>>8,
	]);
}

const successTrack = new Uint8Array([
	// power on
	0xB3, 0x26-0x10, 0b10000000,
	// l vol (-LLL) / r vol (-RRR)
	0xB3, 0x24-0x10, 0b01110111,
	// mixer (LLLL RRRR) for (1234)
	0xB3, 0x25-0x10, 0b11111111,

	// wave channel
	...[
		0x02,0x46,0x8A,0xCE,0xFF,0xFE,0xED,0xDC,0xCB,0xA9,0x87,0x65,0x44,0x33,0x22,0x11
	].map((val, i) => [0xB3, 0x30-0x10+i, val])
	.reduce((arr, x) => arr.concat(x)),

	// song
	... new Array(6).fill().map((_,i) => {
		const note = [gameboy.C5, gameboy.E5, gameboy.G5][i%3];
		const beats = [3,2][i%2];
		return hit(note, beats);
	}).reduce((arr,x) => [].concat.apply(arr, x), []),
]);

gameboy.bgm(successTrack.buffer, -1).play();

function addButton(name, fn) {
	const button = document.createElement('button');
	button.innerText = name;
	button.style.cssText = `display: block; width: 200px; margin: 10px auto; padding: 20px 0;`
	button.addEventListener('click', fn);

	document.body.appendChild(button);
}

addButton('boop', gameboy.sfx(hit(gameboy.C6,5)).play);

const bumpBytes = new Uint8Array([
	// power on
	0xB3, 0x26-0x10, 0b10000000,
	// l vol (-LLL) / r vol (-RRR)
	0xB3, 0x24-0x10, 0b01110111,
	// enable channels
	0xB3, 0x25-0x10, 0b11111111,
	// sweep
	0xB3, 0x10-0x10, 0b01111010,
	// duty, length
	0xB3, 0x11-0x10, 0b10111111,
	// start volume VVVV, direction A (+/- =1/0), period PPP
	0xB3, 0x12-0x10, 0b11110001,
	// pitch low
	0xB3, 0x13-0x10, gameboy.C4&0xFF,
	// trigger 1, something? 0, --- pitch high HHH
	0xB3, 0x14-0x10, 0b10000000 + (gameboy.C4>>8),
	// track duration
	0x61, (44100/2)&0xFF, (44100/2)>>8,
]);
const bumpSFX = gameboy.sfx(bumpBytes, [1,0,0,0])

let stopHandle = null;
addButton('*BUMP BUMP BUMP*', (evt) => {
	if (stopHandle) {
		clearInterval(stopHandle);
		stopHandle = null;
	} else {
		bumpSFX.play();
		stopHandle = setInterval(bumpSFX.play, 350);
	}
	evt.target.innerText = (stopHandle) ? '*stop bumps*' :'*BUMP BUMP BUMP*'
});

export function transformKeffieFile(/** @type{ArrayBuffer} */arrayBuffer) {
	const slowFactor = (0x400000 / 0x3a0000);
  // get where vgm data starts. this is 
  // (address of where vgm offset is stored, always 0x34)
  // + (value of vgm offset.)
  const data0 = 0x34 + new Uint32Array(arrayBuffer, 0x34, 1)[0];
  // the loop point works similarly
	const oldLoop = 0x1c + new Uint32Array(arrayBuffer, 0x1c, 1)[0] - data0;
	// finally, the rest of the file is the data

  const data = arrayBuffer.slice(data0);
	const inp = new Uint8Array(data);
	const out = [];
	let freqs = [0,0,0];
	let newLoop = -1;
	for (let i = 0; i < inp.length; ++i) {
		if (i === oldLoop) {
			newLoop = out.length;
		}
		const op = inp[i];
		if (op === 0xB3) {
			const addr = inp[++i];
			let chan;
			if (((chan = [0x3, 0x8, 0xD].indexOf(addr))) >= 0) {
				const val = inp[++i];
				freqs[chan] = (freqs[chan] & 0xF00) + val;
			} else if (((chan = [0x4, 0x9, 0xE].indexOf(addr))) >= 0) {
				const val = inp[++i];
				freqs[chan] = (freqs[chan] & 0xFF) + ((val&0x7)<<8);
				const modFreq = Math.round(2048 - (2048 - freqs[chan]) * slowFactor)
				out.push(0xB3, addr-1, modFreq & 0xFF)
				out.push(0xB3, addr, (val&0xF0) + ((modFreq >>8)& 0xF))
			} else {
				out.push(0xB3, addr, inp[++i]);
			}
		} else if (op === 0x61) {
			const t = (inp[++i]) + (inp[++i] << 8); 
			let t1 = t * slowFactor;
			while (t1 > 0xFFFF) {
				out.push(0x61, 0xFF, 0xFF);
				t1 -= 0xFFFF;
			}
			out.push(0x61, t1&0xFF, t1>>8);
		} else if (op === 0x62) {
			const t = 735; // exactly 44100/60
			const t1 = t * slowFactor;
			out.push(0x61, t1&0xFF, t1>>8);
		} else if ((op&0xF0) === 0x70) {
			out.push(op);
		} else if (op === 0x66) {
			out.push(op);
			break;
		} else {
			throw new Error('what is this');
		}
	}
	const outarr = new Uint8Array(data0 + out.length);
	outarr.set(new Uint8Array(arrayBuffer).slice(0, data0));
  outarr.set(out, data0);
  if (newLoop !== -1) {
    new Uint32Array(outarr.buffer, 0x1c, 4)[0] = (data0 - 0x1c) + newLoop;
  }
	return outarr.buffer;
}

const tracks = [vgmURL1, vgmURL2]
.map(url => {
	return fetch(url)
	.then(res => res.arrayBuffer())
	.then(transformKeffieFile)
	.then(gameboy.fromFile)
})

Promise.all(tracks).then(loadedFiles => {
	const trackNames = ['Friendly Battle', 'Title']

	loadedFiles.forEach((track, i) => {
		addButton(trackNames[i], () => {
			track.play();
		});
	})
})

const wavbytes = new Uint8Array([0xB3, 0x15, 0xFF, 0xB3, 0x20, 0xFF, 0xB3, 0x21, 0x00, 0x61, 0xff, 0xff])
const wavsound = gameboy.sfx(wavbytes, [0,0,1,0])
addButton('0x3x', () => {
	wavsound.play();
})
