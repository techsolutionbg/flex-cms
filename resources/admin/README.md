# Admin frontend

The admin interface is a Vite application using Alpine.js, jQuery and Tailwind CSS v4.

The PHP/Twig shell renders the page container and bootstrap JSON. Alpine.js owns local UI state and transitions, while jQuery handles AJAX navigation and CRUD requests. The production package contains only the compiled entrypoint and CSS assets.

Development assets are served by Vite. Production assets are generated with `npm run build`.
