-- HostelHub India PostgreSQL schema
-- Run with: psql -h localhost -U postgres -d hostelhub -f backend/db/schema.sql

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'userrole') THEN
        CREATE TYPE userrole AS ENUM ('super_admin', 'owner', 'warden', 'student');
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'featurename') THEN
        CREATE TYPE featurename AS ENUM ('mess', 'gate_access', 'gst');
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    phone_number VARCHAR(20),
    password_hash VARCHAR(255) NOT NULL,
    role userrole NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_users_id ON users (id);
CREATE INDEX IF NOT EXISTS ix_users_email ON users (email);

CREATE TABLE IF NOT EXISTS rooms (
    id SERIAL PRIMARY KEY,
    room_number VARCHAR(30) NOT NULL UNIQUE,
    capacity INTEGER NOT NULL DEFAULT 1,
    daily_rent NUMERIC(10,2) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_rooms_id ON rooms (id);
CREATE INDEX IF NOT EXISTS ix_rooms_room_number ON rooms (room_number);

CREATE TABLE IF NOT EXISTS residents (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    room_id INTEGER NOT NULL REFERENCES rooms(id),
    monthly_rent NUMERIC(10,2),
    parent_name VARCHAR(100),
    parent_phone_number VARCHAR(20),
    check_in_date DATE NOT NULL,
    check_out_date DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_long_term_residential BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_residents_id ON residents (id);

CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    resident_id INTEGER NOT NULL REFERENCES residents(id),
    room_id INTEGER NOT NULL REFERENCES rooms(id),
    description VARCHAR(255) NOT NULL,
    base_amount NUMERIC(10,2) NOT NULL,
    gst_rate NUMERIC(4,2) NOT NULL DEFAULT 0.0,
    gst_amount NUMERIC(10,2) NOT NULL DEFAULT 0.0,
    total_amount NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_transactions_id ON transactions (id);

CREATE TABLE IF NOT EXISTS feature_settings (
    id SERIAL PRIMARY KEY,
    feature_name featurename NOT NULL UNIQUE,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    updated_by INTEGER REFERENCES users(id),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_feature_settings_id ON feature_settings (id);
