let video;
let classifier; // Not using for this simplified version, but keeping it as a placeholder if you want to integrate ml5.js later
let currentAperture = 8; // f/8
let currentShutter = 125; // 1/125s
let currentISO = 200; // ISO 200

// Available values for adjustment
const apertures = [1.8, 2.8, 4, 5.6, 8, 11, 16, 22];
const shutters = [1, 2, 4, 8, 15, 30, 60, 125, 250, 500, 1000, 2000]; // 1/x second
const isos = [50, 100, 200, 400, 800, 1600, 3200, 6400];

let sceneImages = {}; // Stores background images for each scene
let previewImage; // The image shown in the preview window (simplified for now)

let currentScene = 0; // 0: Sunny, 1: Cloudy, 2: Rainy
let scenes = [
    {
        name: "晴空萬里的大太陽天",
        background: 'assets/sunny.jpg',
        targetBrightness: '適中', // Internal numeric value for calculation
        targetDepth: '景深較大',
        // Standard answers - adjust these for fine-tuning
        stdApertureIndex: 4, // f/8
        stdShutterIndex: 9, // 1/500s
        stdISOIndex: 1, // ISO 100
        overExpImg: 'assets/sunny_over.jpg',
        underExpImg: 'assets/sunny_under.jpg'
    },
    {
        name: "舒適的陰天",
        background: 'assets/cloudy.jpg',
        targetBrightness: '適中',
        targetDepth: '景深適中',
        stdApertureIndex: 3, // f/5.6
        stdShutterIndex: 7, // 1/125s
        stdISOIndex: 2, // ISO 200
        overExpImg: 'assets/cloudy_over.jpg',
        underExpImg: 'assets/cloudy_under.jpg'
    },
    {
        name: "綿綿細雨的雨天",
        background: 'assets/rainy.jpg',
        targetBrightness: '適中',
        targetDepth: '景深較淺',
        stdApertureIndex: 1, // f/2.8
        stdShutterIndex: 6, // 1/60s
        stdISOIndex: 4, // ISO 800
        overExpImg: 'assets/rainy_over.jpg',
        underExpImg: 'assets/rainy_under.jpg'
    }
];

let gameState = 'start'; // 'start', 'playing', 'result'
let score = 0;
let explanationText = '';
let explanationTitle = '';

// Hand detection variables (simplified)
let leftHandX = 0, leftHandY = 0;
let rightHandX = 0, rightHandY = 0;
let prevLeftHandY = 0;
let prevRightHandX = 0;
let prevLeftHandAvgColor = [0, 0, 0];
let prevRightHandAvgColor = [0, 0, 0];
const handDetectThreshold = 30; // Min pixel change to detect hand movement
const handDetectRegionWidth = 0.2; // Percentage of screen width for hand detection regions
const handDetectRegionHeight = 0.8; // Percentage of screen height for hand detection regions (vertically centered)

// Timing variables for detecting stable hand or "clap" for shutter
let shutterPressTimer = 0;
const shutterPressThreshold = 20; // Frames to detect stable hand or "clap"
let isShutterPressed = false;

function preload() {
    // Load all background images
    for (let i = 0; i < scenes.length; i++) {
        sceneImages[scenes[i].name] = loadImage(scenes[i].background);
        if (scenes[i].overExpImg) loadImage(scenes[i].overExpImg); // Preload over-exposed
        if (scenes[i].underExpImg) loadImage(scenes[i].underExpImg); // Preload under-exposed
    }
}

function setup() {
    createCanvas(windowWidth * 0.8, windowHeight * 0.8); // Adjust canvas size
    video = createCapture(VIDEO);
    video.size(width, height);
    video.hide(); // Hide the HTML video element

    // Initialize parameters to standard answer for first scene
    currentAperture = apertures[scenes[currentScene].stdApertureIndex];
    currentShutter = shutters[scenes[currentScene].stdShutterIndex];
    currentISO = isos[scenes[currentScene].stdISOIndex];

    noStroke();
    rectMode(CENTER);
    textAlign(CENTER, CENTER);
    imageMode(CENTER); // For drawing background images
}

function draw() {
    background(0); // Black background
    
    // Draw the scene background
    if (sceneImages[scenes[currentScene].name]) {
        image(sceneImages[scenes[currentScene].name], width / 2, height / 2, width, height);
    }

    if (gameState === 'start') {
        drawStartScreen();
    } else if (gameState === 'playing') {
        drawPlayingScreen();
    } else if (gameState === 'result') {
        drawResultScreen();
    }
}

function drawStartScreen() {
    fill(0, 150); // Semi-transparent overlay
    rect(width / 2, height / 2, width, height);
    fill(255);
    textSize(48);
    text("《光影捕手：天氣挑戰》", width / 2, height / 2 - 50);
    textSize(24);
    text("請用雙手操控相機設定，拍出正確曝光！", width / 2, height / 2 + 20);
    textSize(20);
    text("點擊螢幕任意處開始...", width / 2, height / 2 + 100);
}

function drawPlayingScreen() {
    // Draw video feed for hand detection
    push();
    translate(width, 0); // Flip horizontally
    scale(-1, 1);
    image(video, 0, 0, width, height); // Show video feed
    pop();

    // Perform simplified hand detection and parameter adjustment
    detectAndAdjustHands();

    // Display Camera Parameters
    fill(255);
    textSize(24);
    text(`光圈: f/${currentAperture}`, width / 2, 30);
    text(`快門: 1/${currentShutter}s`, width / 2, 60);
    text(`ISO: ${currentISO}`, width / 2, 90);

    // Display current scene info
    textSize(20);
    fill(255, 200, 0);
    text(`關卡 ${currentScene + 1}: ${scenes[currentScene].name}`, width / 2, height - 80);
    text(`目標亮度: ${scenes[currentScene].targetBrightness}`, width / 2, height - 50);
    text(`目標景深: ${scenes[currentScene].targetDepth}`, width / 2, height - 20);

    // Draw preview window
    drawPreview();

    // Shutter button feedback
    if (isShutterPressed) {
        fill(255, 0, 0, 150); // Red overlay
        ellipse(width / 2, height / 2, 100, 100);
    }
}

function drawPreview() {
    // Simplified preview logic: combine exposure and depth based on current settings
    let simulatedExposureValue = calculateExposureValue(currentAperture, currentShutter, currentISO);
    let targetEV = calculateExposureValue(
        apertures[scenes[currentScene].stdApertureIndex],
        shutters[scenes[currentScene].stdShutterIndex],
        isos[scenes[currentScene].stdISOIndex]
    );

    let previewImage;
    if (simulatedExposureValue > targetEV + 1.5) { // Threshold for over-exposed
        previewImage = loadImage(scenes[currentScene].overExpImg);
    } else if (simulatedExposureValue < targetEV - 1.5) { // Threshold for under-exposed
        previewImage = loadImage(scenes[currentScene].underExpImg);
    } else {
        previewImage = sceneImages[scenes[currentScene].name];
    }

    // Draw preview image (scaled down)
    const previewWidth = width * 0.3;
    const previewHeight = height * 0.3;
    image(previewImage, width - previewWidth / 2 - 20, height / 2, previewWidth, previewHeight);

    // Optional: Draw a frame around the preview
    noFill();
    stroke(255);
    strokeWeight(2);
    rect(width - previewWidth / 2 - 20, height / 2, previewWidth, previewHeight);
}


function drawResultScreen() {
    // Draw the final simulated photo (based on score)
    let finalImage;
    let simulatedExposureValue = calculateExposureValue(currentAperture, currentShutter, currentISO);
    let targetEV = calculateExposureValue(
        apertures[scenes[currentScene].stdApertureIndex],
        shutters[scenes[currentScene].stdShutterIndex],
        isos[scenes[currentScene].stdISOIndex]
    );

    if (simulatedExposureValue > targetEV + 1.5) {
        finalImage = loadImage(scenes[currentScene].overExpImg);
    } else if (simulatedExposureValue < targetEV - 1.5) {
        finalImage = loadImage(scenes[currentScene].underExpImg);
    } else {
        finalImage = sceneImages[scenes[currentScene].name];
    }
    image(finalImage, width / 2, height / 2, width * 0.8, height * 0.8); // Larger final photo

    fill(0, 180); // Dark overlay
    rect(width / 2, height / 2, width, height);

    fill(255);
    textSize(40);
    text(`分數: ${score} 分`, width / 2, height / 2 - 100);
    
    // Explanation Card
    let explanationCard = select('#explanation-card');
    if (!explanationCard) {
        explanationCard = createDiv();
        explanationCard.id('explanation-card');
        explanationCard.parent('body');
        explanationCard.style('top', '50%');
        explanationCard.style('left', '50%');
        explanationCard.style('transform', 'translate(-50%, -50%)');
    }
    explanationCard.html(`
        <h3>${explanationTitle}</h3>
        <p>${explanationText}</p>
        <button onclick="nextRound()">下一關</button>
    `);
    explanationCard.style('display', 'block');
}

function mousePressed() {
    if (gameState === 'start') {
        gameState = 'playing';
    }
}

// Simplified hand detection and parameter adjustment
function detectAndAdjustHands() {
    if (!video.loadedPixels) {
        video.loadPixels();
    }
    
    // Define hand detection regions
    let leftRegionX = 0;
    let rightRegionX = width - width * handDetectRegionWidth;
    let regionY = height * (1 - handDetectRegionHeight) / 2;
    let regionWidth = width * handDetectRegionWidth;
    let regionHeight = height * handDetectRegionHeight;

    // Detect average color in regions (very simplified way to check for "hand presence")
    let currentLeftHandAvgColor = getAverageColor(leftRegionX, regionY, regionWidth, regionHeight);
    let currentRightHandAvgColor = getAverageColor(rightRegionX, regionY, regionWidth, regionHeight);
    
    let leftHandDetected = colorDifference(currentLeftHandAvgColor, prevLeftHandAvgColor) > handDetectThreshold;
    let rightHandDetected = colorDifference(currentRightHandAvgColor, prevRightHandAvgColor) > handDetectThreshold;

    // Update hand positions based on movement
    if(leftHandDetected) {
        leftHandX = leftRegionX + regionWidth/2; // Center of detection area
        leftHandY = getHandY(leftRegionX, regionY, regionWidth, regionHeight); // Estimate Y based on pixel changes
    } else {
        leftHandY = height/2; // Reset if not detected
    }
    if(rightHandDetected) {
        rightHandX = rightRegionX + regionWidth/2;
        rightHandY = getHandY(rightRegionX, regionY, regionWidth, regionHeight);
    } else {
        rightHandX = width/2; // Reset if not detected
    }

    // --- Parameter Adjustments ---

    // 1. Adjust Aperture (Left Hand Y-axis)
    if (leftHandDetected) {
        let yMovement = leftHandY - prevLeftHandY;
        if (abs(yMovement) > 5) { // Detect significant movement
            let currentApertureIndex = apertures.indexOf(currentAperture);
            if (yMovement < 0 && currentApertureIndex < apertures.length - 1) { // Move up -> smaller aperture value (larger F-number)
                currentAperture = apertures[currentApertureIndex + 1];
            } else if (yMovement > 0 && currentApertureIndex > 0) { // Move down -> larger aperture value (smaller F-number)
                currentAperture = apertures[currentApertureIndex - 1];
            }
        }
    }

    // 2. Adjust Shutter (Right Hand X-axis)
    if (rightHandDetected) {
        let xMovement = rightHandX - prevRightHandX;
        if (abs(xMovement) > 5) { // Detect significant movement
            let currentShutterIndex = shutters.indexOf(currentShutter);
            if (xMovement > 0 && currentShutterIndex < shutters.length - 1) { // Move right -> faster shutter
                currentShutter = shutters[currentShutterIndex + 1];
            } else if (xMovement < 0 && currentShutterIndex > 0) { // Move left -> slower shutter
                currentShutter = shutters[currentShutterIndex - 1];
            }
        }
    }

    // 3. Adjust ISO (Dual Hand X-axis distance)
    if (leftHandDetected && rightHandDetected) {
        let handDistance = abs(leftHandX - rightHandX);
        let prevHandDistance = abs(prevLeftHandX - prevRightHandX); // This part is tricky without precise hand X
        
        // Simplified: check if hands are moving closer or further in general terms
        // This will be very basic with current simple detection.
        // A better approach would require actual hand tracking libraries.
        
        // For now, let's say if hands are roughly in the center third, we check ISO
        if (leftHandX > width/3 && rightHandX < width * 2/3) { 
            let isoIndex = isos.indexOf(currentISO);
            // This logic needs refinement with true hand tracking
            // Example: if left hand moves right and right hand moves left (closer) -> ISO down
            // if left hand moves left and right hand moves right (further) -> ISO up
            // This is a very rough implementation without accurate X for hands.
            // Let's make it simpler for now:
            if (abs(leftHandX - width/2) < 20 && abs(rightHandX - width/2) < 20) { // If both hands are roughly in center
                 // And if they are getting closer (simulated by some condition)
                // This is where real hand tracking for depth would be needed
            }
        }
    }


    // --- Shutter Press (Dual Hand "Clap" or "Steady in Center") ---
    // Simplified: If both hands are detected and roughly in the middle, increase shutter timer.
    // If timer exceeds threshold, trigger shutter.
    const centerRegionX = width * 0.4;
    const centerRegionWidth = width * 0.2;
    const centerRegionY = height * 0.4;
    const centerRegionHeight = height * 0.2;

    let leftHandInCenter = (leftHandX > centerRegionX && leftHandX < centerRegionX + centerRegionWidth && leftHandY > centerRegionY && leftHandY < centerRegionY + centerRegionHeight);
    let rightHandInCenter = (rightHandX > centerRegionX && rightHandX < centerRegionX + centerRegionWidth && rightHandY > centerRegionY && rightHandY < centerRegionY + centerRegionHeight);
    
    if (leftHandDetected && rightHandDetected && leftHandInCenter && rightHandInCenter) {
        shutterPressTimer++;
        if (shutterPressTimer > shutterPressThreshold && !isShutterPressed) {
            isShutterPressed = true;
            takePhoto();
        }
    } else {
        shutterPressTimer = 0;
        isShutterPressed = false;
    }


    // Update previous hand states
    prevLeftHandY = leftHandY;
    prevRightHandX = rightHandX;
    prevLeftHandAvgColor = currentLeftHandAvgColor;
    prevRightHandAvgColor = currentRightHandAvgColor;
}

// Helper to get average color of a region (very basic hand detection)
function getAverageColor(x, y, w, h) {
    let sumR = 0, sumG = 0, sumB = 0;
    let count = 0;
    video.loadPixels();
    for (let i = x; i < x + w; i++) {
        for (let j = y; j < y + h; j++) {
            let index = (i + j * video.width) * 4;
            sumR += video.pixels[index];
            sumG += video.pixels[index + 1];
            sumB += video.pixels[index + 2];
            count++;
        }
    }
    return [sumR / count, sumG / count, sumB / count];
}

// Helper to estimate Y position within a region (find bright spot, etc. - very primitive)
function getHandY(x, y, w, h) {
    let brightestY = y + h / 2; // Default to center
    let maxBrightness = 0;
    video.loadPixels();
    for (let j = y; j < y + h; j+=5) { // Sample every 5 pixels
        let rowBrightness = 0;
        for (let i = x; i < x + w; i+=5) {
            let index = (i + j * video.width) * 4;
            rowBrightness += (video.pixels[index] + video.pixels[index+1] + video.pixels[index+2]) / 3;
        }
        if (rowBrightness > maxBrightness) {
            maxBrightness = rowBrightness;
            brightestY = j;
        }
    }
    return brightestY;
}


// Helper to calculate color difference
function colorDifference(c1, c2) {
    return dist(c1[0], c1[1], c1[2], c2[0], c2[1], c2[2]);
}

function takePhoto() {
    // Calculate exposure value (EV) for current settings and standard settings
    // EV = log2(N^2 / t) + log2(ISO/100)
    // N = Aperture F-number, t = Shutter speed in seconds
    let currentEV = calculateExposureValue(currentAperture, currentShutter, currentISO);
    let stdEV = calculateExposureValue(
        apertures[scenes[currentScene].stdApertureIndex],
        shutters[scenes[currentScene].stdShutterIndex],
        isos[scenes[currentScene].stdISOIndex]
    );

    // Calculate score based on EV difference
    let evDiff = abs(currentEV - stdEV);
    score = max(0, 100 - evDiff * 15); // Adjust multiplier (15) for desired difficulty

    // Determine explanation text
    setExplanationText(currentEV, stdEV);

    gameState = 'result';
    isShutterPressed = false; // Reset shutter press state
    select('#explanation-card').style('display', 'block'); // Ensure card is visible
}

function calculateExposureValue(aperture, shutter, iso) {
    // Shutter speed in seconds (e.g., 1/125s -> 0.008s)
    let t = 1 / shutter;
    if (shutter === 1) t = 1; // For 1 second shutter

    // Simplified EV calculation
    // log2(N^2 / t) + log2(ISO/100)
    return log(aperture * aperture / t) / log(2) + log(iso / 100) / log(2);
}


function setExplanationText(currentEV, stdEV) {
    let diff = currentEV - stdEV; // Positive means brighter than target, negative means darker

    explanationTitle = "";
    explanationText = "";

    const scene = scenes[currentScene];

    if (abs(diff) < 1.0) { // Close to perfect
        explanationTitle = "完美曝光！";
        explanationText = "你做得太棒了！你的設定與理想曝光非常接近，精準捕捉了光線。繼續保持！";
    } else if (diff > 1.5) { // Overexposed
        explanationTitle = "有點過曝！";
        explanationText = `你的照片比理想亮度亮了一些。在${scene.name}這種光線條件下，下次可以嘗試${getOverExposureHint(scene.name)}，讓光線更適中。`;
    } else if (diff < -1.5) { // Underexposed
        explanationTitle = "照片太暗了！";
        explanationText = `你的照片比理想亮度暗了一些。在${scene.name}這種光線條件下，下次可以嘗試${getUnderExposureHint(scene.name)}，讓光線更充足。`;
    } else if (diff >= 1.0 && diff <= 1.5) { // Slightly over
        explanationTitle = "稍亮了一些！";
        explanationText = `你的照片稍微亮了一點點。在${scene.name}這種條件下，可以微調光圈或快門，讓光線更完美。`;
    } else if (diff <= -1.0 && diff >= -1.5) { // Slightly under
        explanationTitle = "稍暗了一些！";
        explanationText = `你的照片稍微暗了一點點。在${scene.name}這種條件下，可以微調光圈或快門，讓光線更完美。`;
    }

    // Add specific scene context to explanation (more detailed hints)
    switch (currentScene) {
        case 0: // Sunny
            if (abs(diff) < 1.0) {
                explanationText += "大太陽下光線充足，縮小光圈或加快快門是很好的選擇。";
            }
            break;
        case 1: // Cloudy
            if (abs(diff) < 1.0) {
                explanationText += "陰天光線柔和，適度開大光圈或放慢快門是關鍵。";
            }
            break;
        case 2: // Rainy
            if (abs(diff) < 1.0) {
                explanationText += "雨天光線昏暗，大幅提高 ISO 和開大光圈是低光攝影的挑戰！";
            }
            break;
    }
}

function getOverExposureHint(sceneName) {
    if (sceneName === "晴空萬里的大太陽天") {
        return "**縮小光圈 (讓F值變大)** 或 **加快快門速度**。";
    } else if (sceneName === "舒適的陰天") {
        return "**稍微縮小光圈** 或 **加快快門速度**。";
    } else if (sceneName === "綿綿細雨的雨天") {
        return "檢查是不是 **ISO 開得太高**了，或是 **光圈太大**，**快門太慢**了，雨天光線雖弱，但組合不對仍會過曝喔。";
    }
    return "調整你的光圈、快門或ISO。";
}

function getUnderExposureHint(sceneName) {
    if (sceneName === "晴空萬里的大太陽天") {
        return "**稍微開大光圈 (讓F值變小)** 或 **放慢快門速度**。";
    } else if (sceneName === "舒適的陰天") {
        return "**開大光圈** 或 **放慢快門速度**，也可以**提高 ISO**。";
    } else if (sceneName === "綿綿細雨的雨天") {
        return "**大幅開大光圈**，**放慢快門**，並**勇敢提高 ISO 感光度**。";
    }
    return "調整你的光圈、快門或ISO。";
}


function nextRound() {
    select('#explanation-card').style('display', 'none'); // Hide the card
    currentScene++;
    if (currentScene >= scenes.length) {
        currentScene = 0; // Loop back to the first scene
        // Or transition to a 'Game Over' screen
        // gameState = 'gameOver';
    }
    // Reset parameters for the new scene to its standard answer
    currentAperture = apertures[scenes[currentScene].stdApertureIndex];
    currentShutter = shutters[scenes[currentScene].stdShutterIndex];
    currentISO = isos[scenes[currentScene].stdISOIndex];
    gameState = 'playing';
}

function windowResized() {
    resizeCanvas(windowWidth * 0.8, windowHeight * 0.8);
    video.size(width, height);
}

// 簡單的手部位置估計 (通過亮度峰值，非常原始)
// 這需要根據實際光線和膚色進行調整，在複雜背景下效果不佳
function getHandRegionY(regionX, regionY, regionWidth, regionHeight) {
    let maxY = regionY + regionHeight / 2;
    let maxVal = 0;
    
    // Iterate through a vertical strip of the region to find the "brightest" row
    for (let y = regionY; y < regionY + regionHeight; y += 5) { // Skip pixels for performance
        let rowSum = 0;
        for (let x = regionX; x < regionX + regionWidth; x += 5) { // Skip pixels
            // Ensure pixel coordinates are within video bounds
            let vidX = floor(map(x, 0, width, 0, video.width)); // Map canvas X to video X
            let vidY = floor(map(y, 0, height, 0, video.height)); // Map canvas Y to video Y
            let index = (vidX + vidY * video.width) * 4;
            // Check if index is within bounds before accessing
            if (index >= 0 && index < video.pixels.length - 3) {
                rowSum += (video.pixels[index] + video.pixels[index + 1] + video.pixels[index + 2]) / 3;
            }
        }
        if (rowSum > maxVal) {
            maxVal = rowSum;
            maxY = y;
        }
    }
    return maxY;
}

// Better Hand Detection logic: Using simple difference from previous frame
// This will detect *movement* more than *presence*
function detectAndAdjustHands() {
    if (!video.loadedPixels) {
        video.loadPixels();
        return;
    }

    let currentLeftHandYPos = 0;
    let currentRightHandXPos = 0;
    let currentIsoDetectVal = 0; // For ISO adjustment

    // Left Hand Region (Aperture)
    let leftRegionStart = 0;
    let leftRegionEnd = width * 0.3;
    let leftRegionAvg = calculateRegionAvgBrightness(leftRegionStart, 0, leftRegionEnd, height);
    if (abs(leftRegionAvg - prevLeftHandAvgColor[0]) > 5) { // Check for significant change in brightness
        // Estimate Y position if hand is detected
        let currentY = map(leftRegionAvg, 0, 255, height, 0); // Crude estimation, brighter = higher
        if (abs(currentY - leftHandY) > 5) { // Only adjust if significant movement
            leftHandY = lerp(leftHandY, currentY, 0.2); // Smooth movement
            let apertureIndex = apertures.indexOf(currentAperture);
            if (leftHandY < height * 0.4 && apertureIndex < apertures.length - 1) { // Hand moves up
                currentAperture = apertures[apertureIndex + 1];
            } else if (leftHandY > height * 0.6 && apertureIndex > 0) { // Hand moves down
                currentAperture = apertures[apertureIndex - 1];
            }
        }
    }
    prevLeftHandAvgColor[0] = leftRegionAvg; // Store for next frame

    // Right Hand Region (Shutter)
    let rightRegionStart = width * 0.7;
    let rightRegionEnd = width;
    let rightRegionAvg = calculateRegionAvgBrightness(rightRegionStart, 0, rightRegionEnd, height);
    if (abs(rightRegionAvg - prevRightHandAvgColor[0]) > 5) { // Check for significant change in brightness
        // Estimate X position if hand is detected
        let currentX = map(rightRegionAvg, 0, 255, 0, width); // Crude estimation
        if (abs(currentX - rightHandX) > 5) { // Only adjust if significant movement
            rightHandX = lerp(rightHandX, currentX, 0.2); // Smooth movement
            let shutterIndex = shutters.indexOf(currentShutter);
            if (rightHandX > width * 0.6 && shutterIndex < shutters.length - 1) { // Hand moves right
                currentShutter = shutters[shutterIndex + 1];
            } else if (rightHandX < width * 0.4 && shutterIndex > 0) { // Hand moves left
                currentShutter = shutters[shutterIndex - 1];
            }
        }
    }
    prevRightHandAvgColor[0] = rightRegionAvg; // Store for next frame

    // ISO Adjustment (Dual Hand distance - more complex without real tracking)
    // For a simplified version, let's use a "zoom" gesture: moving hands closer/further in the center
    let centerRegionWidth = width * 0.4;
    let centerRegionHeight = height * 0.4;
    let centerRegionX = (width - centerRegionWidth) / 2;
    let centerRegionY = (height - centerRegionHeight) / 2;

    let centerAvg = calculateRegionAvgBrightness(centerRegionX, centerRegionY, centerRegionWidth, centerRegionHeight);
    let prevCenterAvg = (prevLeftHandAvgColor[1] + prevRightHandAvgColor[1])/2; // Using other channels to store prev for ISO
    
    if (abs(centerAvg - prevCenterAvg) > 8) { // If significant brightness change in center (indicating hand movement)
        let isoIndex = isos.indexOf(currentISO);
        // This is a very rough estimation for ISO based on a "zoom" like gesture
        // A simple way: If average brightness in center increases (hands closer?), decrease ISO, else increase
        if (centerAvg > prevCenterAvg) { // Hands likely moving closer/making region brighter (decrease ISO)
             if (isoIndex > 0) currentISO = isos[isoIndex - 1];
        } else { // Hands likely moving apart/making region darker (increase ISO)
             if (isoIndex < isos.length - 1) currentISO = isos[isoIndex + 1];
        }
    }
    prevLeftHandAvgColor[1] = centerAvg; // Store for next frame for ISO detection

    // Shutter button (clap/steady hands in middle)
    // Check if both hands are detected and steady in the center
    let leftHandInCenter = (leftHandX > centerRegionX && leftHandX < centerRegionX + centerRegionWidth && leftHandY > centerRegionY && leftHandY < centerRegionY + centerRegionHeight);
    let rightHandInCenter = (rightHandX > centerRegionX && rightHandX < centerRegionX + centerRegionWidth && rightHandY > centerRegionY && rightHandY < centerRegionY + centerRegionHeight);

    if (leftHandDetected && rightHandDetected && abs(leftHandX - rightHandX) < width * 0.3) { // If hands are relatively close
        shutterPressTimer++;
        if (shutterPressTimer > shutterPressThreshold && !isShutterPressed) {
            isShutterPressed = true;
            takePhoto();
        }
    } else {
        shutterPressTimer = 0;
        isShutterPressed = false;
    }
}

// Helper: Calculate average brightness of a given region in the video feed
function calculateRegionAvgBrightness(x, y, w, h) {
    let sumBrightness = 0;
    let pixelCount = 0;
    video.loadPixels();
    for (let i = x; i < x + w; i += 5) { // Sample every few pixels for performance
        for (let j = y; j < y + h; j += 5) {
            let vidX = floor(map(i, 0, width, 0, video.width));
            let vidY = floor(map(j, 0, height, 0, video.height));
            let index = (vidX + vidY * video.width) * 4;
            if (index >= 0 && index < video.pixels.length - 3) {
                sumBrightness += (video.pixels[index] + video.pixels[index + 1] + video.pixels[index + 2]) / 3;
                pixelCount++;
            }
        }
    }
    return pixelCount > 0 ? sumBrightness / pixelCount : 0;
}