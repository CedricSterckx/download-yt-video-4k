const fs = require('fs');
const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const { SingleBar, Presets } = require('cli-progress');

// Set FFmpeg path to use the static binary included in ffmpeg-static
ffmpeg.setFfmpegPath(ffmpegStatic);

const args = process.argv.slice(2);
const videoURL = args[args.indexOf('--input-url') + 1];
const outputVideoPath = args[args.indexOf('--output') + 1];

// Initialize progress bars
const videoProgressBar = new SingleBar({}, Presets.shades_classic);
const audioProgressBar = new SingleBar({}, Presets.shades_classic);
const mergeProgressBar = new SingleBar({}, Presets.shades_classic);

// Function to download video with progress
async function downloadVideo() {
    console.log('Downloading video...');
    const videoPath = 'tempVideo.mp4';
    const video = ytdl(videoURL, { quality: 'highestvideo' });

    let videoSize = 0;
    video.on('response', res => {
        videoSize = parseInt(res.headers['content-length'], 10);
        videoProgressBar.start(videoSize, 0, { speed: "N/A" });
    });

    video.on('data', chunk => {
        videoProgressBar.increment(chunk.length);
    });

    video.on('end', () => {
        videoProgressBar.stop();
        console.log('Video download completed.');
    });

    video.pipe(fs.createWriteStream(videoPath));

    return new Promise((resolve, reject) => {
        video.on('finish', () => resolve(videoPath));
        video.on('error', reject);
    });
}

// Function to download audio with progress
async function downloadAudio() {
    console.log('Downloading audio...');
    const audioPath = 'tempAudio.mp4';
    const audio = ytdl(videoURL, { quality: 'highestaudio', filter: 'audioonly' });

    let audioSize = 0;
    audio.on('response', res => {
        audioSize = parseInt(res.headers['content-length'], 10);
        audioProgressBar.start(audioSize, 0, { speed: "N/A" });
    });

    audio.on('data', chunk => {
        audioProgressBar.increment(chunk.length);
    });

    audio.on('end', () => {
        audioProgressBar.stop();
        console.log('Audio download completed.');
    });

    audio.pipe(fs.createWriteStream(audioPath));

    return new Promise((resolve, reject) => {
        audio.on('finish', () => resolve(audioPath));
        audio.on('error', reject);
    });
}

// Function to merge video and audio with progress
async function mergeVideoAndAudio(videoPath, audioPath) {
    console.log('Combining video and audio...');
    mergeProgressBar.start(100, 0);

    return new Promise((resolve, reject) => {
        ffmpeg()
            .input(videoPath)
            .input(audioPath)
            .outputOptions(['-c:v copy', '-c:a aac', '-strict experimental', '-shortest'])
            .output(outputVideoPath)
            .on('error', (err) => {
                mergeProgressBar.stop();
                reject(err);
            })
            .on('progress', (progress) => {
                mergeProgressBar.update(progress.percent);
            })
            .on('end', () => {
                mergeProgressBar.stop();
                console.log('Merging completed.');
                resolve();
            })
            .run();
    });
}

// Main function to run the tasks
async function downloadAndMergeVideoAudio() {
    try {
        const videoPath = await downloadVideo();
        const audioPath = await downloadAudio();
        await mergeVideoAndAudio(videoPath, audioPath);
        // Cleanup temporary files
        fs.unlinkSync(videoPath);
        fs.unlinkSync(audioPath);
        console.log('Process completed successfully.');
    } catch (error) {
        console.error('An error occurred:', error);
    }
}

// Run the main function
downloadAndMergeVideoAudio();
