// Error handling
function showError(message) {
    const app = document.getElementById('app');
    const template = document.getElementById('error-template');
    const content = template.content.cloneNode(true);

    content.querySelector('.error-text').textContent = message;

    app.innerHTML = '';
    app.appendChild(content);
}

// Loading indicator
function showLoader() {
    const app = document.getElementById('app');
    app.innerHTML = '<div class="loader">Loading...</div>';
}

// Error handling wrapper
function withErrorHandling(handler) {
    return async (...args) => {
        try {
            await handler(...args);
        } catch (error) {
            showError(error.message || 'Something went wrong');
        }
    };
}

// Data fetching
async function fetchData(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
}

// Router setup with wrapped handlers
const routes = {
    '#/': withErrorHandling(showBuildsPage),
    '#/builds': withErrorHandling(showBuildsPage),
    '#/builds/:build': withErrorHandling(showTestsPage),
    '#/builds/:build/tests/:test': withErrorHandling(showComparisonPage)
};

function handleRoute() {
    const hash = window.location.hash || '#/';

    for (const [route, handler] of Object.entries(routes)) {
        const pattern = new RegExp('^' + route.replace(/:(\w+)/g, '([^/]+)') + '$');
        const match = hash.match(pattern);

        if (match) {
            const params = match.slice(1);
            handler(...params);
            return;
        }
    }

    showBuildsPage();
}

// Navigation
function navigate(event) {
    if (event) {
        event.preventDefault();
        const href = event.currentTarget.getAttribute('href');
        window.location.hash = href;
    }
    handleRoute();
}

// Page handlers without try-catch
async function showBuildsPage() {
    showLoader();
    const builds = await fetchData('/api/builds');

    const template = document.getElementById('builds-template');
    const content = template.content.cloneNode(true);
    const buildsList = content.querySelector('#builds');

    // Use DocumentFragment for DOM operations optimization
    const fragment = document.createDocumentFragment();

    builds.forEach(build => {
        const itemTemplate = document.getElementById('build-item-template');
        const item = itemTemplate.content.cloneNode(true);

        const link = item.querySelector('.build-link');
        link.href = `#/builds/${build}`;
        link.textContent = build;
        link.addEventListener('click', navigate);

        // Restore delete button handler
        const deleteBtn = item.querySelector('.delete-build');
        deleteBtn.addEventListener('click', withErrorHandling(async () => {
            if (!confirm(`Are you sure you want to delete build ${build}?`)) return;

            await fetch(`/api/builds/${build}`, { method: 'DELETE' });
            navigate();
        }));

        fragment.appendChild(item);
    });

    buildsList.appendChild(fragment);
    app.innerHTML = '';
    app.appendChild(content);
}

async function showTestsPage(build) {
    showLoader();

    const tests = await fetchData(`/api/builds/${build}/tests`);
    const builds = await fetchData('/api/builds');

    const app = document.getElementById('app');
    const template = document.getElementById('tests-template');
    const content = template.content.cloneNode(true);

    // Set build name in all places
    content.querySelectorAll('.build-name').forEach(el => {
        el.textContent = build;
    });

    // Add navigation
    const nav = content.querySelector('.navigation');
    const currentBuildIndex = builds.indexOf(build);
    nav.innerHTML = `
        ${currentBuildIndex > 0 ?
            `<a href="#/builds/${builds[currentBuildIndex - 1]}" onclick="navigate(event)">← Previous Build</a>` :
            '<span class="disabled">← Previous Build</span>'}
        <a href="#/builds" onclick="navigate(event)">All Builds</a>
        ${currentBuildIndex < builds.length - 1 ?
            `<a href="#/builds/${builds[currentBuildIndex + 1]}" onclick="navigate(event)">Next Build →</a>` :
            '<span class="disabled">Next Build →</span>'}
    `;

    // Fill tests list
    const testsList = content.querySelector('#tests');
    tests.forEach(test => {
        const li = document.createElement('li');
        const link = document.createElement('a');
        link.href = `#/builds/${build}/tests/${test}`;
        link.textContent = test;
        link.addEventListener('click', navigate);
        li.appendChild(link);
        testsList.appendChild(li);
    });

    app.innerHTML = '';
    app.appendChild(content);
}

async function showComparisonPage(build, test) {
    showLoader();

    // Fetch data
    const { buildScreenshots, approvedScreenshots } = await fetchData(`/api/builds/${build}/tests/${test}/screenshots`);
    const tests = await fetchData(`/api/builds/${build}/tests`);
    const builds = await fetchData('/api/builds');

    // Setup page
    const app = document.getElementById('app');
    const template = document.getElementById('comparison-template');
    const content = template.content.cloneNode(true);

    // Set names
    content.querySelectorAll('.build-name').forEach(el => el.textContent = build);
    content.querySelector('.test-name').textContent = test;

    // Add build navigation
    const buildNav = content.querySelector('.build-nav');
    const currentBuildIndex = builds.indexOf(build);
    buildNav.innerHTML = `
        ${currentBuildIndex > 0 ?
            `<a href="#/builds/${builds[currentBuildIndex - 1]}" onclick="navigate(event)">← Previous Build</a>` :
            '<span class="disabled">← Previous Build</span>'}
        <a href="#/builds" onclick="navigate(event)">All Builds</a>
        ${currentBuildIndex < builds.length - 1 ?
            `<a href="#/builds/${builds[currentBuildIndex + 1]}" onclick="navigate(event)">Next Build →</a>` :
            '<span class="disabled">Next Build →</span>'}
    `;

    // Add test navigation
    const testNav = content.querySelector('.test-nav');
    const currentTestIndex = tests.indexOf(test);
    testNav.innerHTML = `
        ${currentTestIndex > 0 ?
            `<a href="#/builds/${build}/tests/${tests[currentTestIndex - 1]}" onclick="navigate(event)">← Previous Test</a>` :
            '<span class="disabled">← Previous Test</span>'}
        <a href="#/builds/${build}" onclick="navigate(event)">All Tests</a>
        ${currentTestIndex < tests.length - 1 ?
            `<a href="#/builds/${build}/tests/${tests[currentTestIndex + 1]}" onclick="navigate(event)">Next Test →</a>` :
            '<span class="disabled">Next Test →</span>'}
    `;

    // Add screenshots
    const approvedCarousel = content.querySelector('#approved');
    const currentCarousel = content.querySelector('#current');

    approvedScreenshots.forEach(({ name }, index) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'image-wrapper';

        const img = document.createElement('img');
        img.src = `/api/builds/screenshot?path=${encodeURIComponent(`approved/${test}/${name}`)}`;
        if (index === 0) img.classList.add('active');

        wrapper.appendChild(img);
        approvedCarousel.appendChild(wrapper);
    });

    buildScreenshots.forEach(({ name }, index) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'image-wrapper';

        const img = document.createElement('img');
        img.src = `/api/builds/screenshot?path=${encodeURIComponent(`builds/${build}/${test}/${name}`)}`;
        if (index === 0) img.classList.add('active');

        wrapper.appendChild(img);
        currentCarousel.appendChild(wrapper);
    });

    // Add carousel navigation handlers
    const prevButton = content.querySelector('.prev');
    const nextButton = content.querySelector('.next');

    prevButton.addEventListener('click', () => scrollBothCarousels(-1));
    nextButton.addEventListener('click', () => scrollBothCarousels(1));

    // Check if test is already approved
    const approveButton = content.querySelector('.approve');
    if (approvedScreenshots.length > 0 &&
        buildScreenshots.every(build =>
            approvedScreenshots.some(approved =>
                build.hash === approved.hash
            )
        )) {
        approveButton.textContent = 'Approved ✓';
        approveButton.disabled = true;
    }

    // Add approve handler
    approveButton.addEventListener('click', withErrorHandling(async () => {
        await fetch(`/api/builds/${build}/tests/${test}/approve`, { method: 'POST' });
        approveButton.textContent = 'Approved ✓';
        approveButton.disabled = true;
    }));

    app.innerHTML = '';
    app.appendChild(content);
}

// Add carousel scroll function
function scrollBothCarousels(direction) {
    const approved = document.getElementById('approved');
    const current = document.getElementById('current');
    const scrollAmount = approved.clientWidth;

    // Clear highlights and reset button
    const highlightButton = document.querySelector('.highlight');
    const highlights = document.querySelectorAll('.diff-highlight, .diff-tooltip');
    highlights.forEach(el => el.remove());
    highlightButton.style.display = 'inline-block';
    highlightButton.disabled = false;

    // Update active class
    const updateActiveImage = (carousel) => {
        const images = carousel.querySelectorAll('img');
        const activeImage = carousel.querySelector('img.active');
        const currentIndex = Array.from(images).indexOf(activeImage);
        const newIndex = (currentIndex + direction + images.length) % images.length;

        activeImage.classList.remove('active');
        images[newIndex].classList.add('active');
    };

    approved.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
    current.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });

    updateActiveImage(approved);
    updateActiveImage(current);
}

// Initialize router
window.addEventListener('hashchange', handleRoute);
handleRoute();

function showComparison(buildId, testName) {
    // ... existing code ...
}

async function handleHighlightDiff(button, loader) {
    if (button.disabled) return;

    button.disabled = true;
    button.style.display = 'none';
    loader.style.display = 'inline-block';

    try {
        const [currentImage, approvedImage] = getActiveImages();
        const result = await compareImages(currentImage.src, approvedImage.src);

        // Add highlight rectangles
        [currentImage, approvedImage].forEach(img => {
            const carousel = img.closest('.carousel');

            // Calculate scale factors
            const scaleX = img.clientWidth / img.naturalWidth;
            const scaleY = img.clientHeight / img.naturalHeight;

            result.regions.forEach(region => {
                const highlight = document.createElement('div');
                highlight.className = 'diff-highlight';
                highlight.dataset.severity = region.severity;

                // Scale the coordinates
                const scaledX = region.x * scaleX;
                const scaledY = region.y * scaleY;
                const scaledWidth = region.width * scaleX;
                const scaledHeight = region.height * scaleY;

                // Position the highlight relative to wrapper
                highlight.style.left = `${scaledX}px`;
                highlight.style.top = `${scaledY}px`;
                highlight.style.width = `${scaledWidth}px`;
                highlight.style.height = `${scaledHeight}px`;

                // Create tooltip
                const tooltip = document.createElement('div');
                tooltip.className = 'diff-tooltip';
                tooltip.innerHTML = `
                    <strong>${region.description || 'No details'}</strong>
                    <br>Severity: ${region.severity || 'unknown'}
                `;

                // Add hover events
                highlight.addEventListener('mouseenter', () => {
                    tooltip.style.display = 'block';
                });
                highlight.addEventListener('mouseleave', () => {
                    tooltip.style.display = 'none';
                });

                // Update tooltip position on mousemove
                highlight.addEventListener('mousemove', (e) => {
                    const rect = highlight.getBoundingClientRect();
                    tooltip.style.left = `${e.offsetX + 10}px`;
                    tooltip.style.top = `${e.offsetY + 10}px`;
                });

                // Update tooltip styles
                tooltip.style.position = 'absolute';
                tooltip.style.whiteSpace = 'nowrap';  // Prevent text wrapping

                // Add tooltip to highlight instead of wrapper
                const wrapper = img.parentElement;
                wrapper.appendChild(highlight);
                highlight.appendChild(tooltip);
            });
        });

    } catch (error) {
        console.error('Error highlighting differences:', error);
        alert('Failed to highlight differences: ' + error.message);
        button.disabled = false;
    } finally {
        loader.style.display = 'none';
    }
}

function getActiveImages() {
    const currentImage = document.querySelector('#current img.active');
    const approvedImage = document.querySelector('#approved img.active');

    if (!currentImage || !approvedImage) {
        throw new Error('Images not found');
    }

    return [currentImage, approvedImage];
}

async function compareImages(image1Url, image2Url) {
    // Get only the path part from the query parameter
    const getMinioPath = (url) => decodeURIComponent(new URL(url).searchParams.get('path'));

    const response = await fetch('/api/builds/compare-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            image1Url: getMinioPath(image1Url),
            image2Url: getMinioPath(image2Url)
        })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error);

    return data;
}
