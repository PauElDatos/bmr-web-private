# Visualizar esquema `bmr` en MySQL Workbench sin reverse engineering directo

Este flujo genera scripts SQL de solo estructura desde la conexion tunelada (solo lectura) y los importa en Workbench como modelo visual.

## 1) Levantar tunel SSH a la VM

Usa un tunel local, por ejemplo `127.0.0.1:3307 -> mysql_vm:3306`.

## 2) Exportar variables de entorno

### Windows PowerShell

```powershell
$env:BMR_MYSQL_HOST="127.0.0.1"
$env:BMR_MYSQL_PORT="3307"
$env:BMR_MYSQL_USER="root"
$env:BMR_MYSQL_PASSWORD="TU_PASSWORD"
$env:BMR_MYSQL_DATABASE="bmr"
python tools/export_bmr_schema_for_workbench.py
python tools/check_bmr_schema_health.py
```

### Linux/macOS (bash)

```bash
export BMR_MYSQL_HOST=127.0.0.1
export BMR_MYSQL_PORT=3307
export BMR_MYSQL_USER=root
export BMR_MYSQL_PASSWORD='TU_PASSWORD'
export BMR_MYSQL_DATABASE=bmr
python tools/export_bmr_schema_for_workbench.py
python tools/check_bmr_schema_health.py
```

## 3) Salidas generadas

- `out/bmr_schema_workbench.sql`: estructura base (tablas, tipos, indices), sin datos.
- `out/bmr_schema_workbench_with_inferred_fks.sql`: igual que el anterior + FKs inferidas para EER.
- `out/bmr_schema_health_report.md`: diagnostico de salud del esquema.

## 4) Importar en MySQL Workbench

1. Abrir MySQL Workbench.
2. Ir a `File -> Import -> Reverse Engineer MySQL Create Script`  
   (alternativa: `Model -> Reverse Engineer MySQL Create Script`).
3. Seleccionar `out/bmr_schema_workbench_with_inferred_fks.sql`.
4. Finalizar el wizard.
5. Crear `EER Diagram` desde catalog objects.
6. Aplicar `Arrange -> Auto Layout`.

## 5) Seguridad / alcance

- Este proceso **no modifica** la DB real.
- Los scripts Python hacen solo lecturas (`information_schema` + `SHOW CREATE TABLE`).
- Las FKs inferidas se escriben en un archivo SQL para modelado visual, no se aplican en produccion.
