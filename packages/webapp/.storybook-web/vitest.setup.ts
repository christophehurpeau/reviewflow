// `@storybook/addon-vitest` applies the preview annotations itself; the only
// thing missing in the browser is the stylesheet, which vite compiles here with
// the app's own postcss/tailwind config so a story renders with the app classes
import "#/global.css";
