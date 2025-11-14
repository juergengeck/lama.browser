# LAMA Browser Deployment Guide

This guide covers deploying LAMA Browser to a remote server using SFTP or SSH.

## Prerequisites

### For SFTP with Password Authentication
- Install `sshpass`:
  - **macOS**: `brew install sshpass`
  - **Linux**: `apt-get install sshpass` or `yum install sshpass`

### For SSH Key Authentication (Recommended)
- SSH key pair configured on your system
- Public key added to remote server's `~/.ssh/authorized_keys`

## Quick Start

### 1. Configure Deployment Credentials

Copy the example configuration file:
```bash
cp .env.deploy.example .env.deploy
```

Edit `.env.deploy` with your credentials:
```bash
# SFTP Connection Details
# Option 1: Separate user and host (clearer)
export SFTP_USER="myusername"
export SFTP_HOST="lama.one"

# Option 2: Combined format (also works)
# export SFTP_HOST="myusername@lama.one"

export SFTP_PATH="/var/www/lama.one"
export SFTP_PORT="22"

# Choose ONE authentication method:

# Option A: Password (requires sshpass)
export SFTP_PASSWORD="your-password-here"

# Option B: SSH Key (recommended)
export SFTP_KEY_PATH="$HOME/.ssh/id_rsa"

# Option C: Default SSH Key
# Leave both SFTP_PASSWORD and SFTP_KEY_PATH empty
```

### 2. Deploy

Source the configuration and run deployment:
```bash
source .env.deploy && ./deploy.sh
```

Or set variables inline:
```bash
SFTP_USER=myusername SFTP_HOST=lama.one SFTP_PASSWORD=secret ./deploy.sh
```

Or use combined format:
```bash
SFTP_HOST=myusername@lama.one SFTP_PASSWORD=secret ./deploy.sh
```

## Deployment Process

The script performs these steps:

1. **Build** - Compiles the browser UI with Vite
2. **Verify** - Checks build output exists
3. **Package** - Creates `.tar.gz` and `.zip` archives in `deploy/`
4. **Upload** - Transfers package to server via SFTP
5. **Deploy** - Extracts, backs up old version, switches atomically

## Authentication Methods

### Password Authentication

**Pros:**
- Simple setup
- No key management

**Cons:**
- Less secure
- Requires `sshpass` tool
- Password visible in process list

**Setup:**
```bash
export SFTP_PASSWORD="your-password"
./deploy.sh
```

### SSH Key Authentication (Recommended)

**Pros:**
- More secure
- No password in environment
- Works with ssh-agent

**Cons:**
- Requires initial key setup

**Setup:**
```bash
# Generate key if needed
ssh-keygen -t rsa -b 4096

# Copy to server
ssh-copy-id user@lama.one

# Deploy with default key
./deploy.sh

# Or specify key path
export SFTP_KEY_PATH="$HOME/.ssh/custom_key"
./deploy.sh
```

## Transport Options

### SFTP (Default)

Uses SFTP for file transfer and SSH for remote commands.

```bash
DEPLOY_TRANSPORT=sftp ./deploy.sh
```

### SSH (Legacy)

Uses SCP for file transfer and SSH with sudo for deployment.

```bash
DEPLOY_TRANSPORT=ssh ./deploy.sh
```

## Rollback

If deployment fails, rollback instructions are displayed:

### SFTP Transport
```bash
ssh user@lama.one
rm -rf /var/www/lama.one
mv /var/www/lama.one.old /var/www/lama.one
```

### SSH Transport
```bash
ssh user@lama.one
sudo rm -rf /var/www/lama.one
sudo mv /var/www/lama.one.old /var/www/lama.one
```

Backups are also saved on the server:
```
/tmp/lama-browser-backup-YYYYMMDD_HHMMSS.tar.gz
```

## Command Line Arguments

```bash
./deploy.sh [server] [path] [transport]
```

**Examples:**
```bash
# Use environment variables
./deploy.sh

# Override with arguments
./deploy.sh user@example.com /var/www/app sftp

# Mix both
SFTP_PASSWORD=secret ./deploy.sh user@lama.one /var/www/lama.one
```

## Troubleshooting

### "sshpass: command not found"
Install sshpass or use SSH key authentication instead.

### "Permission denied (publickey,password)"
- Verify username and password/key are correct
- Check server allows password or key authentication
- Verify public key is in server's `~/.ssh/authorized_keys`

### "Cannot write to deployment path"
- Ensure user has write permissions to deployment directory
- Use SSH transport with sudo, or adjust directory permissions

### Connection timeout
- Check SFTP_PORT is correct (default: 22)
- Verify firewall allows connections
- Test connection manually: `sftp user@lama.one`

## Security Best Practices

1. **Use SSH keys** instead of passwords
2. **Never commit** `.env.deploy` to git (already in `.gitignore`)
3. **Limit key permissions**: `chmod 600 ~/.ssh/id_rsa`
4. **Use ssh-agent** for key management
5. **Rotate credentials** regularly
6. **Use different keys** for different servers

## Directory Structure After Deployment

```
/var/www/lama.one/          # Active deployment
/var/www/lama.one.old/      # Previous version (for rollback)
/tmp/lama-browser-backup-*  # Timestamped backups
```

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: Deploy to Production
  env:
    SFTP_HOST: ${{ secrets.SFTP_HOST }}
    SFTP_PASSWORD: ${{ secrets.SFTP_PASSWORD }}
    SFTP_PATH: /var/www/lama.one
  run: ./deploy.sh
```

### GitLab CI Example

```yaml
deploy:
  script:
    - export SFTP_HOST=$SFTP_HOST
    - export SFTP_PASSWORD=$SFTP_PASSWORD
    - ./deploy.sh
  only:
    - main
```
