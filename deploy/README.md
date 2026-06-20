# LivePoly Deployment

The deployment runs on one EC2 host with Docker Compose:

- Nginx is the only service publishing host ports (`80` and `443`).
- Two API containers sit behind an `ip_hash` upstream for Socket.IO affinity.
- One worker container processes game jobs. Worker startup and recovery are
  additionally protected by the application singleton lock.
- PgBouncer uses transaction pooling between the applications and PostgreSQL.
- PostgreSQL and Redis are reachable only on private Docker networks.
- Redis uses AOF persistence and `noeviction`; reaching its memory limit fails
  writes instead of silently deleting game or queue state.

## Secret

Create an AWS Secrets Manager JSON secret named `livepoly`. Use the keys shown
in `deploy/.env.example`. Keep the deployed database name as `livepoly`; the
local example uses `livepoly-local` so DBeaver and other clients make the
environment obvious. Generate URL-safe alphanumeric PostgreSQL and Redis
passwords because Compose uses them to construct internal connection URLs.

The EC2 role needs narrowly scoped permission to read this secret and access the
backup bucket. The GitHub deployment role does not read application secrets; it
only sends and inspects SSM commands for the LivePoly instance.

## GitHub Variables

Add these repository Actions variables:

- `AWS_INSTANCE_ID`: the EC2 instance ID.
- `AWS_DEPLOY_ROLE_ARN`: the GitHub OIDC deployment role ARN.
- `AWS_SECRET_ID`: `livepoly`.

The repository must be readable by the EC2 deployment process. A public
repository works directly. A private repository requires a read-only deploy key
or GitHub App credential on the server.

## Deployment

The pipeline verifies lint, tests, application build, Compose rendering, and
both production images. A successful `main` pipeline assumes the AWS role via
GitHub OIDC and invokes the instance through SSM. No permanent AWS access key or
public SSH port is required.

Each deployment creates `/opt/livepoly/releases/<commit>`, runs migrations
against PostgreSQL directly, starts the stack, and checks readiness through
Nginx. The `current` symlink changes only after readiness succeeds. The newest
three release directories remain on the host.

## TLS

The first deployment uses `http.conf.template` so the ACME challenge is
reachable. After `api.livepoly.site` points to the instance, request the
certificate with the `certbot` tools profile, change `NGINX_TEMPLATE` in Secrets
Manager to `https.conf.template`, and redeploy. Certificate data lives in the
named `letsencrypt` volume.

## Backups

`backup-postgres.sh` creates a custom-format PostgreSQL dump, uploads it to
`BACKUP_S3_URI`, confirms the object exists, and only then removes old backups.
The newest five dumps are retained locally and in S3. Install and enable the
provided systemd service and timer after the first successful deployment. The
timer runs on EC2, not GitHub Actions, at `02:30 UTC` with a small randomized
delay so backups avoid the usual midnight boundary while still happening during
quiet hours for Europe/Africa.
