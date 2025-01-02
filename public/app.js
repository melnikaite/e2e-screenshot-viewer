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

    // Add test navigation
    const testNav = content.querySelector('.test-navigation');
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

    approvedScreenshots.forEach(({ name }) => {
        const img = document.createElement('img');
        img.src = `/api/builds/screenshot?path=${encodeURIComponent(`approved/${test}/${name}`)}`;
        approvedCarousel.appendChild(img);
    });

    buildScreenshots.forEach(({ name }) => {
        const img = document.createElement('img');
        img.src = `/api/builds/screenshot?path=${encodeURIComponent(`builds/${build}/${test}/${name}`)}`;
        currentCarousel.appendChild(img);
    });

    // Add carousel navigation handlers
    const prevButton = content.querySelector('.prev-button');
    const nextButton = content.querySelector('.next-button');

    prevButton.addEventListener('click', () => scrollBothCarousels(-1));
    nextButton.addEventListener('click', () => scrollBothCarousels(1));

    // Check if test is already approved
    const approveButton = content.querySelector('#approve-button');
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

    approved.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
    current.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
}

// Initialize router
window.addEventListener('hashchange', handleRoute);
handleRoute();
