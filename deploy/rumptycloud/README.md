# Rumptycloud deployment

Use the repository's root `Dockerfile` with the repository root as the build
context. It installs both npm workspaces before compiling the web app, so
`@klaveroq/domain` resolves locally instead of being requested from npm.

In Rumptycloud, select Dockerfile/custom Docker deployment if that option is
available. Select branch `staging`, Dockerfile path `Dockerfile`, build context
`.` (repository root), and application port `8080`. Remove the previous build
and start command overrides and use the Dockerfile defaults. If a start override
is required, use `node apps/web/server.js` from `/app`.

The logs should show `npm ci --include=dev --no-audit --no-fund` after copying
both workspace manifests. If they still show an automatic `npm install` that
requests `@klaveroq/domain` from the registry, the platform is still using its
automatic Node builder. Confirm Dockerfile support with Rumptycloud; changing a
later build command cannot repair an earlier failed dependency-install step.

The runtime binds to `0.0.0.0`, defaults to port `8080`, and honors a supplied
`PORT`. Configure runtime environment variables in the hosting dashboard;
`.env` files are excluded from the image. The image does not apply database
migrations or provision PostgreSQL, object storage, email, or a scanner.

Use `/api/health/live` for liveness and `/api/health/ready` for readiness. The
readiness endpoint also requires valid production provider settings and a
reachable, migrated database. Existing DigitalOcean environment requirements
also apply when hosting on Rumptycloud.

To build and check locally:

```sh
docker build -t klaveroq-web .
docker run --rm -p 8080:8080 --env-file .env klaveroq-web
curl --fail http://localhost:8080/api/health/live
```

For the beta with uploads disabled, configure `DEPLOYMENT_STAGE=community_beta`,
`IDENTITY_PROVIDER=disabled`, `IDENTITY_SANDBOX_ENABLED=0` and
`FILE_UPLOADS_ENABLED=false`, along with the database, session and email settings.
Enabling uploads additionally requires the selected storage backend and ClamAV.
