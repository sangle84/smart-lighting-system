CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE role (
    role_id SERIAL PRIMARY KEY,
    role_name VARCHAR(30) NOT NULL UNIQUE
        CHECK (role_name IN ('ADMIN', 'OPERATOR', 'VIEWER')),
    description VARCHAR(255)
);

CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role_id INT NOT NULL REFERENCES role(role_id) ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'LOCKED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE device (
    device_id VARCHAR(50) PRIMARY KEY,
    device_name VARCHAR(100) NOT NULL,
    location VARCHAR(150),
    assigned_user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    device_status VARCHAR(20) NOT NULL DEFAULT 'OFFLINE'
        CHECK (device_status IN ('ONLINE', 'OFFLINE', 'FAULT')),
    lifecycle_status VARCHAR(20) NOT NULL DEFAULT 'REGISTERED'
        CHECK (lifecycle_status IN (
            'REGISTERED', 'PROVISIONED', 'ACTIVE', 'MAINTENANCE', 'DECOMMISSIONED'
        )),
    firmware_version VARCHAR(30) NOT NULL DEFAULT '1.0.0',
    credential_hash VARCHAR(255) NOT NULL,
    adaptive_config JSONB NOT NULL DEFAULT '{
        "enabled": true,
        "motion_timeout_sec": 30,
        "lux_thresholds": [
            {"min_lux": 400, "pwm": 30},
            {"min_lux": 200, "pwm": 50},
            {"min_lux": 100, "pwm": 70},
            {"min_lux": 0, "pwm": 100}
        ],
        "no_motion_pwm": 10
    }'::jsonb,
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE device_access (
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    device_id VARCHAR(50) NOT NULL REFERENCES device(device_id) ON DELETE RESTRICT,
    granted_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, device_id)
);

CREATE TABLE telemetry (
    telemetry_id BIGSERIAL PRIMARY KEY,
    device_id VARCHAR(50) NOT NULL REFERENCES device(device_id) ON DELETE RESTRICT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    lux NUMERIC(8, 2) NOT NULL,
    motion BOOLEAN NOT NULL DEFAULT FALSE,
    voltage NUMERIC(6, 2) NOT NULL,
    current NUMERIC(6, 3) NOT NULL,
    power NUMERIC(7, 3) NOT NULL,
    pwm SMALLINT NOT NULL CHECK (pwm >= 0 AND pwm <= 100)
);

CREATE TABLE command (
    command_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id VARCHAR(50) NOT NULL REFERENCES device(device_id) ON DELETE RESTRICT,
    user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    command_type VARCHAR(20) NOT NULL
        CHECK (command_type IN ('PWM', 'ON', 'OFF')),
    command_value SMALLINT
        CHECK (command_value BETWEEN 0 AND 100),
    status VARCHAR(25) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'SENT', 'ACKNOWLEDGED', 'TIMEOUT', 'FAILED')),
    sent_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ack_at TIMESTAMPTZ,
    result VARCHAR(50),
    CONSTRAINT command_value_by_type CHECK (
        (command_type = 'PWM' AND command_value IS NOT NULL
            AND command_value BETWEEN 0 AND 100)
        OR
        (command_type IN ('ON', 'OFF') AND command_value IS NULL)
    )
);

CREATE TABLE alert (
    alert_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id VARCHAR(50) NOT NULL REFERENCES device(device_id) ON DELETE RESTRICT,
    alert_type VARCHAR(30) NOT NULL
        CHECK (alert_type IN ('LAMP_FAULT', 'DEVICE_OFFLINE')),
    severity VARCHAR(20) NOT NULL DEFAULT 'MEDIUM'
        CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    message TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'NEW'
        CHECK (status IN ('NEW', 'ACKNOWLEDGED', 'RESOLVED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    acknowledged_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    resolved_by UUID REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE audit_log (
    log_id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    device_id VARCHAR(50) REFERENCES device(device_id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    description TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_device_access_device ON device_access (device_id);
CREATE INDEX idx_telemetry_device_timestamp
    ON telemetry (device_id, timestamp DESC);
CREATE INDEX idx_command_device ON command (device_id, sent_at DESC);
CREATE INDEX idx_alert_status ON alert (status);
CREATE INDEX idx_audit_created_at ON audit_log (created_at DESC);
