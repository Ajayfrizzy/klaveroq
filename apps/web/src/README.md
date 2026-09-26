# Web source organization

The `app` directory follows Next.js routing conventions. Route and page files should remain thin: compose feature components in pages and delegate business operations from API routes to feature server modules.

## Where code belongs

| Code                                                         | Location              |
| ------------------------------------------------------------ | --------------------- |
| Next.js page, layout, or API entry point                     | `app/`                |
| Product-specific component, schema, or service               | `features/<feature>/` |
| Reusable application layout                                  | `components/layout/`  |
| Reusable feature-independent UI                              | `components/ui/`      |
| Database, HTTP, file, and other shared server infrastructure | `server/`             |
| Global styling and design tokens                             | `styles/`             |

Feature modules may contain `components`, `server`, tests, and schemas as needed. Keep fabricated records inside isolated tests rather than runtime source modules. Avoid barrel files inside features unless they provide a deliberate public boundary; direct imports make ownership easier to trace.

The files under `server/jobs` and `server/fees` currently preserve legacy import paths. New code should import the corresponding modules from `features`.
