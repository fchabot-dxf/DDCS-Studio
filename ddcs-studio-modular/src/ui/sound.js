// sound.js - simple audio helper for click sounds

// Path relative to index.html; the file lives under src/assets
const audioUrl = 'assets/audio/421337__jaszunio15__click_100.wav';
const VOLUME = 0.5; // 50% default volume
const clickSound = new Audio(audioUrl);
clickSound.preload = 'auto';
clickSound.volume = VOLUME;

// WebAudio context and buffer for reversed playback
let audioCtx = null;
let reversedBuffer = null;
let gainNode = null; // to control volume for WebAudio

// Attempt to lazily initialize audio context and reversed buffer on load.
(async function initBuffers() {
    try {
        // Safari requires context created in response to user gesture; this
        // may be created later when play* is first called.
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        // prepare gain node for volume control
        gainNode = audioCtx.createGain();
        gainNode.gain.value = VOLUME;
        gainNode.connect(audioCtx.destination);
        const resp = await fetch(audioUrl);
        const arrayBuf = await resp.arrayBuffer();
        const buf = await audioCtx.decodeAudioData(arrayBuf);
        // create a reversed copy
        reversedBuffer = audioCtx.createBuffer(
            buf.numberOfChannels,
            buf.length,
            buf.sampleRate
        );
        for (let ch = 0; ch < buf.numberOfChannels; ch++) {
            const srcData = buf.getChannelData(ch);
            const dstData = reversedBuffer.getChannelData(ch);
            for (let i = 0, j = buf.length - 1; i < buf.length; i++, j--) {
                dstData[i] = srcData[j];
            }
        }
    } catch (e) {
        // If anything goes wrong we simply won't have reversed playback.
        console.warn('sound.js: failed to prepare reversed buffer', e);
        reversedBuffer = null;
    }
})();

/**
 * Play the normal click sound.  If playback is not allowed (e.g. user
 * hasn't interacted with the page yet) the promise failure is silently
 * ignored.
 */
export function playClick() {
    try {
        clickSound.currentTime = 0;
        clickSound.play().catch(() => {});
        // resume AudioContext if suspended (some browsers require it)
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    } catch (e) {
        // silent
    }
}

/**
 * Play the click sound reversed once.  Falls back to the forward sound if the
 * reversed buffer is unavailable.
 */
export function playClickReverse() {
    if (audioCtx && reversedBuffer) {
        try {
            if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
            const src = audioCtx.createBufferSource();
            src.buffer = reversedBuffer;
            // connect through gain node if it exists to honour volume
            if (gainNode) {
                src.connect(gainNode);
            } else {
                src.connect(audioCtx.destination);
            }
            src.start(0);
        } catch (e) {
            // fallback
            playClick();
        }
    } else {
        playClick();
    }
}
