CREATE TABLE sensor_test_data (
    id SERIAL PRIMARY KEY,
    temperature FLOAT,
    humidity FLOAT,
    air_quality INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

