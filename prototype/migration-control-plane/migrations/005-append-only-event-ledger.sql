CREATE FUNCTION control_plane.reject_mission_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'control_plane.mission_events is append-only'
    USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER mission_events_append_only
BEFORE UPDATE OR DELETE OR TRUNCATE ON control_plane.mission_events
FOR EACH STATEMENT
EXECUTE FUNCTION control_plane.reject_mission_event_mutation();
