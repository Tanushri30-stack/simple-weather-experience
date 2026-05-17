document.addEventListener('DOMContentLoaded', () => {
    // --- State & DOM Elements ---
    let currentWeatherDesc = "";
    let currentTemp = "";
    let currentCityName = "";

    const searchForm = document.getElementById('searchForm');
    const cityInput = document.getElementById('cityInput');
    const geoBtn = document.getElementById('geoBtn');
    const speakBtn = document.getElementById('speakBtn');
    const datalist = document.getElementById('recentCities');
    
    const weatherContent = document.getElementById('weatherContent');
    const loadingState = document.getElementById('loadingState');

    // --- HTML5 LocalStorage: Recent Searches ---
    function updateRecentCities(city) {
        let cities = JSON.parse(localStorage.getItem('recentCities')) || [];
        if (!cities.includes(city)) {
            cities.unshift(city);
            if (cities.length > 5) cities.pop(); // Keep only last 5
            localStorage.setItem('recentCities', JSON.stringify(cities));
            renderDatalist();
        }
    }

    function renderDatalist() {
        let cities = JSON.parse(localStorage.getItem('recentCities')) || [];
        datalist.innerHTML = '';
        cities.forEach(city => {
            const option = document.createElement('option');
            option.value = city;
            datalist.appendChild(option);
        });
    }

    // Initialize datalist
    renderDatalist();

    // --- Core Logic: Fetching Weather ---
    async function fetchWeatherByCity(city) {
        showLoading("Fetching coordinates...");
        try {
            // Free Geocoding API from Open-Meteo
            const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`);
            const geoData = await geoRes.json();

            if (!geoData.results || geoData.results.length === 0) {
                showError("City not found.");
                return;
            }

            const { latitude, longitude, name, country } = geoData.results[0];
            updateRecentCities(name);
            await fetchWeatherData(latitude, longitude, `${name}, ${country}`);

        } catch (error) {
            showError("Network error.");
        }
    }

    async function fetchWeatherData(lat, lon, locationName) {
        showLoading("Fetching weather data...");
        try {
            // Free Weather API with auto timezone
            const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=auto`);
            const data = await weatherRes.json();

            if (data.current_weather) {
                updateUI(data.current_weather, locationName, data.timezone);
            } else {
                showError("Weather data unavailable.");
            }
        } catch (error) {
            showError("Network error fetching weather.");
        }
    }

    // --- HTML5 Geolocation API ---
    geoBtn.addEventListener('click', () => {
        if (!navigator.geolocation) {
            alert("HTML5 Geolocation is not supported by your browser.");
            return;
        }

        showLoading("Locating your device...");
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                // For geolocation, we just display coordinates as name, or we could reverse geocode.
                // To keep it simple without another API call, we just say "Current Location"
                fetchWeatherData(lat, lon, "Your Location");
            },
            (error) => {
                showError("Geolocation permission denied or unavailable.");
            }
        );
    });

    searchForm.addEventListener('submit', (e) => {
        const city = cityInput.value.trim();
        if (city) fetchWeatherByCity(city);
        cityInput.blur();
    });

    // --- UI Updating & WMO Code Mapping ---
    function updateUI(current, locationName, timezone) {
        currentCityName = locationName;
        currentTemp = current.temperature;
        
        document.getElementById('cityName').textContent = locationName;
        document.getElementById('temperature').textContent = Math.round(current.temperature);
        document.getElementById('windSpeed').textContent = `${current.windspeed} km/h`;
        document.getElementById('windDir').textContent = `${current.winddirection}°`;
        
        const now = new Date();
        document.getElementById('dateString').textContent = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
        
        // Calculate Local Time using the fetched timezone (fallback to UTC if missing)
        const tz = timezone || 'UTC';
        const localTimeStr = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', minute:'2-digit', hour12: true }).format(now);
        document.getElementById('localTime').textContent = localTimeStr;

        // Calculate IST Time explicitly
        const istTimeStr = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute:'2-digit', hour12: true }).format(now);
        document.getElementById('istTime').textContent = istTimeStr;

        // Map WMO Weather Codes to text and emojis
        const wmoCode = current.weathercode;
        const weatherInfo = getWeatherInfo(wmoCode);
        
        currentWeatherDesc = weatherInfo.desc;
        document.getElementById('weatherCondition').textContent = weatherInfo.desc;
        document.getElementById('weatherIcon').textContent = weatherInfo.emoji;

        // Change Theme & Canvas effect based on weather
        document.body.className = weatherInfo.theme;
        currentWeatherEffect = weatherInfo.effect; // For canvas

        loadingState.classList.add('hidden');
        weatherContent.classList.remove('hidden');
    }

    function showLoading(msg) {
        weatherContent.classList.add('hidden');
        loadingState.classList.remove('hidden');
        loadingState.innerHTML = `<p>${msg}</p>`;
    }

    function showError(msg) {
        weatherContent.classList.add('hidden');
        loadingState.classList.remove('hidden');
        loadingState.innerHTML = `<p style="color:#ffcccc;">${msg}</p>`;
    }

    function getWeatherInfo(code) {
        // Simple mapping of Open-Meteo WMO codes
        if (code === 0) return { desc: "Clear Sky", emoji: "☀️", theme: "theme-clear", effect: "clear" };
        if (code >= 1 && code <= 3) return { desc: "Partly Cloudy", emoji: "⛅", theme: "theme-cloudy", effect: "clouds" };
        if (code >= 45 && code <= 48) return { desc: "Foggy", emoji: "🌫️", theme: "theme-cloudy", effect: "clouds" };
        if (code >= 51 && code <= 67) return { desc: "Rainy", emoji: "🌧️", theme: "theme-rain", effect: "rain" };
        if (code >= 71 && code <= 77) return { desc: "Snow", emoji: "❄️", theme: "theme-rain", effect: "snow" };
        if (code >= 80 && code <= 82) return { desc: "Rain Showers", emoji: "🌦️", theme: "theme-rain", effect: "rain" };
        if (code >= 95 && code <= 99) return { desc: "Thunderstorm", emoji: "⛈️", theme: "theme-rain", effect: "rain" };
        return { desc: "Unknown", emoji: "🌡️", theme: "theme-clear", effect: "clear" };
    }

    // --- HTML5 Web Speech API ---
    speakBtn.addEventListener('click', () => {
        if (!('speechSynthesis' in window)) {
            alert("Sorry, HTML5 Web Speech API is not supported in this browser.");
            return;
        }
        
        const textToSpeak = `Currently in ${currentCityName}, the weather is ${currentWeatherDesc} with a temperature of ${currentTemp} degrees Celsius.`;
        
        // Cancel any ongoing speech
        window.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        // Optional: tweak voice settings
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        
        window.speechSynthesis.speak(utterance);
    });

    // --- HTML5 Canvas API: Dynamic Weather Backgrounds ---
    const canvas = document.getElementById('weatherCanvas');
    const ctx = canvas.getContext('2d');
    let width, height;
    let particles = [];
    let currentWeatherEffect = 'clear';

    function resize() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    class Particle {
        constructor(type) {
            this.type = type;
            this.reset();
        }
        reset() {
            this.x = Math.random() * width;
            this.y = Math.random() * height - height; // Start above screen
            
            if (this.type === 'rain') {
                this.size = Math.random() * 2 + 1;
                this.speedY = Math.random() * 10 + 10;
                this.speedX = Math.random() * 2 - 1;
                this.length = Math.random() * 20 + 10;
            } else if (this.type === 'snow') {
                this.size = Math.random() * 3 + 1;
                this.speedY = Math.random() * 3 + 1;
                this.speedX = Math.random() * 2 - 1;
            } else if (this.type === 'clouds') {
                this.size = Math.random() * 100 + 50;
                this.x = Math.random() * width;
                this.y = Math.random() * (height/2); // Clouds stay high
                this.speedX = Math.random() * 0.5 + 0.1;
                this.speedY = 0;
            }
        }
        update() {
            this.x += this.speedX;
            this.y += this.speedY;

            if (this.y > height || this.x > width || this.x < -this.size) {
                if (currentWeatherEffect !== this.type) {
                    // Die if weather changed
                    this.dead = true; 
                } else {
                    this.reset();
                    if(this.type !== 'clouds') this.y = -20; // reset to top
                }
            }
        }
        draw() {
            ctx.beginPath();
            if (this.type === 'rain') {
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
                ctx.lineWidth = this.size;
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(this.x + this.speedX, this.y + this.length);
                ctx.stroke();
            } else if (this.type === 'snow') {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fill();
            } else if (this.type === 'clouds') {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    function manageParticles() {
        // Adjust particle count based on effect
        const targetCounts = { 'rain': 150, 'snow': 100, 'clouds': 10, 'clear': 0 };
        const target = targetCounts[currentWeatherEffect] || 0;

        // Count current alive particles of target type
        const currentCount = particles.filter(p => p.type === currentWeatherEffect && !p.dead).length;

        if (currentCount < target) {
            particles.push(new Particle(currentWeatherEffect));
        }

        // Clean up dead particles
        particles = particles.filter(p => !p.dead);
    }

    function animate() {
        ctx.clearRect(0, 0, width, height);
        
        manageParticles();

        particles.forEach(p => {
            p.update();
            p.draw();
        });

        requestAnimationFrame(animate);
    }

    // Start canvas animation loop
    animate();
});
