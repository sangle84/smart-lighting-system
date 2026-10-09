\set ON_ERROR_STOP on

INSERT INTO role (role_name, description)
VALUES
    ('ADMIN', 'Quản trị hệ thống'),
    ('OPERATOR', 'Người vận hành'),
    ('VIEWER', 'Người giám sát')
ON CONFLICT (role_name) DO NOTHING;

\if :{?SEED_ADMIN_PASSWORD}
    INSERT INTO users (username, email, password_hash, role_id)
    SELECT
        'admin',
        'admin@smartlighting.local',
        crypt(:'SEED_ADMIN_PASSWORD', gen_salt('bf', 10)),
        role_id
    FROM role
    WHERE role_name = 'ADMIN'
    ON CONFLICT (username) DO NOTHING;
\else
    \echo 'SEED_ADMIN_PASSWORD is required to seed the admin user.'
    \quit 3
\endif
