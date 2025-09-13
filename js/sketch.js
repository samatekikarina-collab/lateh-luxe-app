const w = innerWidth, h = innerHeight;
const amount = 100;

// Typing effect variables
const typingText = "Designed To Make Your Moments Special";
let typingIndex = 0;
let lastTypeTime = 0;
const typingSpeed = 50; // 50ms per character
let startTyping = false; // Flag to delay typing
const typingDelay = 4000; // 4 seconds delay
let isTyping = true; // True for typing, false for untyping
let pauseTime = 0; // Pause before untyping
const pauseDuration = 1000; // 1-second pause after typing completes
let cycleCompleted = false; // Track if one cycle is done

function setup() {
  v = min(w, h);
  createCanvas(w, h);
  background(0);
}

function draw() {
  colorMode(RGB);
  background(0, 0, 0, 10);
  
  var t = frameCount/60 + 3/2*PI;
  t += cos(t)/3*2;
  const R = v/3;
  
  for(let i = 0; i < amount; i++) {
    const a = i/amount * PI * (sin(t)+1) + t;
    const r = v/20 * sin(i/amount*10*PI) * (sin(t)+1)/2;
    const x = w/2 + (R + r) * cos(a);
    const y = h/2 - (R + r) * sin(a);
    
    colorMode(HSB, 2*PI, 100, 100);
    stroke(a - t, 50, 100);
    fill(a - t, 50, 100);
    ellipse(x, y, v/50, v/50);
  }

  // Check if 3 seconds have passed to start typing
  if (!startTyping && millis() > typingDelay) {
    startTyping = true;
    lastTypeTime = millis(); // Reset lastTypeTime for smooth typing start
  }

  // Typing/untyping effect
  if (startTyping && !cycleCompleted && millis() - lastTypeTime > typingSpeed) {
    let textElement = document.querySelector('.typing-text');
    
    if (isTyping) {
      // Typing phase
      if (typingIndex < typingText.length) {
        textElement.textContent = typingText.slice(0, typingIndex + 1);
        typingIndex++;
        lastTypeTime = millis();
      } else {
        // Pause after typing completes
        pauseTime = millis();
        isTyping = false;
      }
    } else {
      // Pause for 1 second before untyping
      if (millis() - pauseTime > pauseDuration) {
        if (typingIndex > 0) {
          // Untyping phase
          textElement.textContent = typingText.slice(0, typingIndex - 1);
          typingIndex--;
          lastTypeTime = millis();
        } else {
          // One cycle completed, redirect to login page
          cycleCompleted = true;
          window.location.href = "login.html"; // Redirect to login page
        }
      }
    }
  }
}
