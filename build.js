const fs = require('fs');
const path = require('path');
const { transform } = require('@babel/core');
const { minify } = require('html-minifier-terser');
const { execSync } = require('child_process');

async function build() {
  const DIST_DIR = path.join(__dirname, 'dist');

  // Create dist directory
  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
  }

  console.log('📦 Building Divvy for production...\n');

  // Step 1: Read source HTML
  console.log('1️⃣  Reading source HTML...');
  const htmlContent = fs.readFileSync(path.join(__dirname, 'divvy.html'), 'utf8');

  // Step 2: Extract React script
  console.log('2️⃣  Extracting React code...');
  const scriptMatch = htmlContent.match(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/);
  if (!scriptMatch) {
    throw new Error('Could not find React script in HTML');
  }
  const reactCode = scriptMatch[1];

  // Step 3: Compile JSX with Babel
  console.log('3️⃣  Compiling JSX with Babel...');
  const compiled = transform(reactCode, {
    presets: [
      ['@babel/preset-env', {
        targets: 'defaults',
        modules: false  // Preserve ES modules (don't convert to CommonJS)
      }],
      ['@babel/preset-react', {
        runtime: 'automatic',
        importSource: 'react'
      }]
    ],
    filename: 'app.js'
  });

  // Write compiled JS
  const compiledJs = compiled.code;
  fs.writeFileSync(path.join(DIST_DIR, 'app.js'), compiledJs);
  console.log('   ✓ Compiled JavaScript written to dist/app.js');

  // Step 4: Build Tailwind CSS
  console.log('4️⃣  Building Tailwind CSS...');
  try {
    // Create a temporary input CSS file with Tailwind directives
    const inputCss = `
@tailwind base;
@tailwind components;
@tailwind utilities;

.material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
  -webkit-user-select: none;
  user-select: none;
}

.material-symbols-outlined.fill {
  font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}

::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

.dark ::-webkit-scrollbar-thumb {
  background: #475569;
}

.dark ::-webkit-scrollbar-thumb:hover {
  background: #64748b;
}

body {
  font-family: 'Inter', sans-serif;
}

.sortable-ghost {
  opacity: 0.4;
}

.sortable-drag {
  cursor: grabbing !important;
}
`;

    const tempCssPath = path.join(__dirname, 'temp-input.css');
    fs.writeFileSync(tempCssPath, inputCss);

    execSync(`npx tailwindcss -i ${tempCssPath} -o ${DIST_DIR}/styles.css --minify`, {
      stdio: 'inherit'
    });

    // Clean up temp file
    fs.unlinkSync(tempCssPath);
    console.log('   ✓ Tailwind CSS built to dist/styles.css');
  } catch (error) {
    console.error('   ✗ Error building Tailwind CSS:', error.message);
    process.exit(1);
  }

  // Step 5: Create production HTML
  console.log('5️⃣  Creating production HTML...');

  // Remove the inline Tailwind config script, Babel script, and React script
  let productionHtml = htmlContent
    // Remove Tailwind CDN
    .replace(/<script src="https:\/\/cdn\.tailwindcss\.com[^"]*"><\/script>\s*/g, '')
    // Remove Tailwind config script
    .replace(/<script>\s*tailwind\.config[\s\S]*?<\/script>\s*/g, '')
    // Remove inline styles (we'll use external CSS)
    .replace(/<style>[\s\S]*?<\/style>\s*/g, '')
    // Remove Babel standalone
    .replace(/<script src="https:\/\/unpkg\.com\/@babel\/standalone\/babel\.min\.js"><\/script>\s*/g, '')
    // Remove the React script
    .replace(/<script type="text\/babel"[^>]*>[\s\S]*?<\/script>\s*/g, '');

  // Add production CSS and JS before </head>
  const headCloseIndex = productionHtml.indexOf('</head>');
  const injectedAssets = `
        <!-- Production Styles -->
        <link rel="stylesheet" href="styles.css">
    `;
  productionHtml = productionHtml.slice(0, headCloseIndex) + injectedAssets + productionHtml.slice(headCloseIndex);

  // Add production JS before service worker registration
  const swScriptIndex = productionHtml.indexOf('<!-- Service Worker Registration -->');
  const injectedJs = `        <!-- Production JavaScript -->
        <script type="module" src="app.js"></script>

`;
  productionHtml = productionHtml.slice(0, swScriptIndex) + injectedJs + productionHtml.slice(swScriptIndex);

  // Step 6: Minify HTML
  console.log('6️⃣  Minifying HTML...');
  const minifiedHtml = await minify(productionHtml, {
    collapseWhitespace: true,
    removeComments: true,
    minifyJS: true,
    minifyCSS: true
  });

  fs.writeFileSync(path.join(DIST_DIR, 'index.html'), minifiedHtml);
  console.log('   ✓ Production HTML written to dist/index.html');

  // Step 7: Copy assets
  console.log('7️⃣  Copying assets...');

  // Copy icons
  const iconsDir = path.join(DIST_DIR, 'icons');
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }
  const iconFiles = fs.readdirSync(path.join(__dirname, 'icons'));
  iconFiles.forEach(file => {
    fs.copyFileSync(
      path.join(__dirname, 'icons', file),
      path.join(iconsDir, file)
    );
  });
  console.log(`   ✓ Copied ${iconFiles.length} icon files`);

  // Copy images
  const imagesDir = path.join(DIST_DIR, 'images');
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }
  const imageFiles = fs.readdirSync(path.join(__dirname, 'images'));
  imageFiles.forEach(file => {
    fs.copyFileSync(
      path.join(__dirname, 'images', file),
      path.join(imagesDir, file)
    );
  });
  console.log(`   ✓ Copied ${imageFiles.length} image files`);

  // Copy manifest and service worker
  fs.copyFileSync(
    path.join(__dirname, 'manifest.json'),
    path.join(DIST_DIR, 'manifest.json')
  );
  fs.copyFileSync(
    path.join(__dirname, 'sw.js'),
    path.join(DIST_DIR, 'sw.js')
  );
  console.log('   ✓ Copied manifest.json and sw.js');

  console.log('\n✨ Build complete! Production files are in the dist/ directory.\n');
}

// Run the build
build().catch(error => {
  console.error('Build failed:', error);
  process.exit(1);
});
