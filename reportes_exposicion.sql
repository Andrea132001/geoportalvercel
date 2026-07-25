-- =============================================
-- TABLA: Reportes de Exposicion
-- Geoportal - Amenaza por Lahar del Cotopaxi
-- =============================================

-- 1. Crear tabla de reportes de exposicion
CREATE TABLE IF NOT EXISTS reportes_exposicion (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(120) DEFAULT 'Anonimo',
    tipo_evento VARCHAR(60) NOT NULL
        CHECK (tipo_evento IN ('Lahar','Desbordamiento de rio','Obstruccion de cauce','Dano en via','Deslizamiento','Caida de ceniza','Otro')),
    descripcion TEXT,
    nivel_afectacion VARCHAR(10) NOT NULL DEFAULT 'Baja'
        CHECK (nivel_afectacion IN ('Baja','Media','Alta')),
    fecha_observacion DATE,
    fecha_reporte TIMESTAMPTZ DEFAULT NOW(),
    latitud DOUBLE PRECISION,
    longitud DOUBLE PRECISION,
    geom GEOMETRY(Point, 4326)
);

-- 2. Trigger: auto-crear geom desde latitud/longitud
CREATE OR REPLACE FUNCTION fn_exposicion_geom()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.latitud IS NOT NULL AND NEW.longitud IS NOT NULL THEN
        NEW.geom = ST_SetSRID(ST_MakePoint(NEW.longitud, NEW.latitud), 4326);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_exposicion_geom ON reportes_exposicion;

CREATE TRIGGER trg_exposicion_geom
    BEFORE INSERT OR UPDATE ON reportes_exposicion
    FOR EACH ROW
    EXECUTE FUNCTION fn_exposicion_geom();

-- 3. Index espacial para consultas rapidas
CREATE INDEX IF NOT EXISTS idx_exposicion_geom
    ON reportes_exposicion USING GIST(geom);

-- 4. Habilitar RLS (Row Level Security)
ALTER TABLE reportes_exposicion ENABLE ROW LEVEL SECURITY;

-- 5. Politica: cualquiera puede INSERTAR
CREATE POLICY "exposicion_insert_public"
    ON reportes_exposicion
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- 6. Politica: cualquiera puede LEER
CREATE POLICY "exposicion_select_public"
    ON reportes_exposicion
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- 7. Permisos
GRANT INSERT ON reportes_exposicion TO anon;
GRANT SELECT ON reportes_exposicion TO anon;

-- 8. Vista resumen
CREATE OR REPLACE VIEW vista_exposicion_resumen AS
SELECT
    tipo_evento,
    nivel_afectacion,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE nivel_afectacion='Alta') AS alta,
    COUNT(*) FILTER (WHERE nivel_afectacion='Media') AS media,
    COUNT(*) FILTER (WHERE nivel_afectacion='Baja') AS baja
FROM reportes_exposicion
GROUP BY tipo_evento, nivel_afectacion
ORDER BY total DESC;
