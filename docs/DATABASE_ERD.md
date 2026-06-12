# Database Entity Relationship Diagram

**Database:** PostgreSQL 15 + PostGIS 3.3  
**Schema version:** 010  
**Total tables:** 22  
**Total indexes:** 55+

---

## Full ERD (Mermaid)

```mermaid
erDiagram

  %% ── Core Identity ──────────────────────────────────────────────────────────

  users {
    uuid        id              PK
    varchar     email           UK
    varchar     password_hash
    varchar     first_name
    varchar     last_name
    user_role   role
    user_status status
    varchar     phone
    text        profile_image_url
    boolean     email_verified
    timestamptz last_login_at
    inet        last_login_ip
    text        last_login_ua
    timestamptz created_at
    timestamptz updated_at
    timestamptz deleted_at      "soft-delete"
  }

  departments {
    uuid        id              PK
    varchar     name
    varchar     code            UK
    text        description
    uuid        head_user_id    FK
    boolean     is_active
    timestamptz created_at
    timestamptz updated_at
    timestamptz deleted_at
  }

  terms {
    uuid        id              PK
    varchar     name
    varchar     code            UK
    term_type   type
    term_status status
    date        start_date
    date        end_date
    boolean     is_active
    timestamptz created_at
    timestamptz updated_at
    timestamptz deleted_at
  }

  %% ── Role Profiles ───────────────────────────────────────────────────────────

  student_profiles {
    uuid        id              PK
    uuid        user_id         FK-UK
    varchar     student_id      UK
    uuid        department_id   FK
    varchar     program
    smallint    current_semester
    smallint    batch_year
    numeric     cgpa
    timestamptz created_at
    timestamptz updated_at
  }

  faculty_profiles {
    uuid        id              PK
    uuid        user_id         FK-UK
    varchar     faculty_id      UK
    uuid        department_id   FK
    varchar     designation
    varchar     specialization
    date        joining_date
    timestamptz created_at
    timestamptz updated_at
  }

  admin_profiles {
    uuid        id              PK
    uuid        user_id         FK-UK
    varchar     admin_id        UK
    uuid        department_id   FK
    boolean     is_super_admin
    jsonb       permissions
    timestamptz created_at
    timestamptz updated_at
  }

  parent_profiles {
    uuid                 id              PK
    uuid                 user_id         FK-UK
    varchar              occupation
    notification_channel preferred_contact
    smallint             alert_threshold_pct
    timestamptz          created_at
    timestamptz          updated_at
  }

  parent_student_links {
    uuid        id              PK
    uuid        parent_user_id  FK
    uuid        student_user_id FK
    varchar     relationship
    boolean     is_primary
    boolean     is_approved
    timestamptz approved_at
    timestamptz created_at
    timestamptz updated_at
    timestamptz deleted_at
  }

  %% ── Academic ────────────────────────────────────────────────────────────────

  subjects {
    uuid        id              PK
    varchar     code            UK
    varchar     name
    text        description
    smallint    credits
    uuid        department_id   FK
    boolean     is_active
    timestamptz created_at
    timestamptz updated_at
    timestamptz deleted_at
  }

  classes {
    uuid        id              PK
    uuid        subject_id      FK
    uuid        term_id         FK
    uuid        faculty_user_id FK
    varchar     section
    varchar     room
    smallint    max_students
    jsonb       schedule_json
    boolean     is_active
    timestamptz created_at
    timestamptz updated_at
    timestamptz deleted_at
  }

  enrollments {
    uuid              id              PK
    uuid              student_user_id FK
    uuid              class_id        FK
    enrollment_status status
    timestamptz       enrolled_at
    timestamptz       dropped_at
    varchar           grade
    timestamptz       created_at
    timestamptz       updated_at
    timestamptz       deleted_at
  }

  %% ── Geofencing ──────────────────────────────────────────────────────────────

  geofence_zones {
    uuid              id              PK
    varchar           name
    text              description
    uuid              department_id   FK
    geography_point   center_point    "GEOGRAPHY(POINT,4326)"
    geography_polygon boundary        "GEOGRAPHY(POLYGON,4326) nullable"
    integer           default_radius_m
    smallint          floor_number
    varchar           building_code
    boolean           is_active
    uuid              created_by      FK
    timestamptz       created_at
    timestamptz       updated_at
    timestamptz       deleted_at
  }

  %% ── Sessions & QR ───────────────────────────────────────────────────────────

  faculty_sessions {
    uuid             id              PK
    uuid             class_id        FK
    uuid             faculty_user_id FK
    uuid             term_id         FK
    session_type     session_type
    session_status   status
    timestamptz      scheduled_start
    timestamptz      scheduled_end
    timestamptz      actual_start
    timestamptz      actual_end
    uuid             geofence_zone_id FK
    varchar          location_name
    geography_point  location_point  "GEOGRAPHY(POINT,4326)"
    integer          geofence_radius_m
    smallint         late_threshold_mins
    smallint         attendance_open_mins
    smallint         expected_count
    smallint         present_count
    smallint         late_count
    smallint         absent_count
    text             notes
    timestamptz      created_at
    timestamptz      updated_at
    timestamptz      deleted_at
  }

  dynamic_qr_sessions {
    uuid        id              PK
    uuid        faculty_session_id FK
    uuid        faculty_user_id FK
    text        token
    varchar     token_hash      UK
    uuid        nonce           UK
    qr_status   status
    timestamptz issued_at
    timestamptz expires_at
    timestamptz revoked_at
    varchar     revoke_reason
    integer     scan_count
    inet        generated_by_ip
    text        generated_by_ua
    timestamptz created_at
  }

  %% ── Biometrics ──────────────────────────────────────────────────────────────

  face_enrollments {
    uuid        id              PK
    uuid        user_id         FK
    text        encrypted_descriptor "AES-256 encrypted"
    varchar     provider
    varchar     external_face_id
    numeric     enrollment_confidence
    numeric     image_quality_score
    boolean     liveness_passed
    boolean     anti_spoof_passed
    boolean     is_active
    integer     verification_count
    timestamptz last_verified_at
    timestamptz expires_at
    inet        enrolled_ip
    text        enrolled_ua
    timestamptz created_at
    timestamptz updated_at
    timestamptz deleted_at
  }

  face_verification_attempts {
    uuid                id              PK
    uuid                faculty_session_id FK
    uuid                student_user_id FK
    uuid                enrollment_id   FK
    verification_result result
    numeric             confidence_score
    numeric             threshold_used
    boolean             liveness_passed
    boolean             anti_spoof_passed
    varchar             failure_reason
    varchar             provider
    integer             provider_response_ms
    inet                attempt_ip
    text                attempt_ua
    varchar             device_id
    timestamptz         attempted_at
  }

  %% ── Attendance ──────────────────────────────────────────────────────────────

  attendance_records {
    uuid              id              PK
    uuid              faculty_session_id FK
    uuid              student_user_id FK
    uuid              class_id        FK
    uuid              term_id         FK
    attendance_status status
    timestamptz       marked_at
    boolean           qr_verified
    timestamptz       qr_verified_at
    uuid              qr_session_id   FK
    boolean           face_verified
    timestamptz       face_verified_at
    numeric           face_confidence
    uuid              face_attempt_id FK
    boolean           geo_verified
    timestamptz       geo_verified_at
    uuid              geo_attempt_id  FK
    boolean           is_manual_override
    uuid              override_request_id FK
    uuid              overridden_by   FK
    text              override_reason
    inet              marked_ip
    text              marked_ua
    varchar           device_id
    verification_step failed_step
    varchar           failure_reason
    timestamptz       created_at
    timestamptz       updated_at
    timestamptz       deleted_at
  }

  location_verification_attempts {
    uuid                id              PK
    uuid                faculty_session_id FK
    uuid                student_user_id FK
    verification_result result
    geography_point     student_point   "GEOGRAPHY(POINT,4326)"
    numeric             reported_accuracy_m
    timestamptz         device_timestamp
    numeric             distance_from_session_m
    integer             geofence_radius_m
    boolean             within_geofence
    boolean             accuracy_suspicious
    boolean             timestamp_suspicious
    boolean             spoofing_detected
    varchar             spoofing_reason
    varchar             failure_reason
    inet                attempt_ip
    text                attempt_ua
    varchar             device_id
    timestamptz         attempted_at
  }

  %% ── Device & Notifications ──────────────────────────────────────────────────

  device_sessions {
    uuid            id              PK
    uuid            user_id         FK
    varchar         refresh_token_hash UK
    varchar         access_token_jti
    device_platform platform
    varchar         device_name
    varchar         device_id
    inet            ip_address
    text            user_agent
    boolean         is_active
    timestamptz     last_active_at
    timestamptz     expires_at
    timestamptz     revoked_at
    varchar         revoke_reason
    timestamptz     created_at
  }

  notifications {
    uuid                 id              PK
    uuid                 recipient_id    FK
    uuid                 sender_id       FK
    notification_type    type
    notification_channel channel
    notification_status  status
    varchar              title
    text                 body
    jsonb                payload
    timestamptz          sent_at
    timestamptz          delivered_at
    timestamptz          read_at
    timestamptz          failed_at
    varchar              failure_reason
    smallint             retry_count
    varchar              external_id
    timestamptz          created_at
    timestamptz          updated_at
  }

  %% ── Audit & Overrides ───────────────────────────────────────────────────────

  audit_logs {
    uuid         id              PK
    uuid         user_id         FK
    audit_action action
    varchar      resource_type
    uuid         resource_id
    jsonb        old_values
    jsonb        new_values
    inet         ip_address
    text         user_agent
    varchar      device_id
    varchar      request_id
    boolean      success
    text         error_message
    jsonb        metadata
    timestamptz  created_at      "immutable - no updated_at"
  }

  manual_override_requests {
    uuid              id              PK
    uuid              faculty_session_id FK
    uuid              student_user_id FK
    uuid              requested_by    FK
    uuid              reviewed_by     FK
    attendance_status requested_status
    attendance_status current_status
    text              reason
    text              supporting_notes
    override_status   status
    timestamptz       reviewed_at
    text              reviewer_notes
    boolean           auto_approved
    inet              request_ip
    text              request_ua
    timestamptz       created_at
    timestamptz       updated_at
    timestamptz       deleted_at
  }

  %% ── Relationships ───────────────────────────────────────────────────────────

  users                       ||--o| student_profiles            : "has"
  users                       ||--o| faculty_profiles            : "has"
  users                       ||--o| admin_profiles              : "has"
  users                       ||--o| parent_profiles             : "has"
  users                       ||--o{ parent_student_links        : "parent side"
  users                       ||--o{ parent_student_links        : "student side"
  users                       ||--o{ face_enrollments            : "has"
  users                       ||--o{ device_sessions             : "has"
  users                       ||--o{ notifications               : "receives"
  users                       ||--o{ audit_logs                  : "generates"
  users                       ||--o{ faculty_sessions            : "teaches"
  users                       ||--o{ enrollments                 : "enrolled in"

  departments                 ||--o{ student_profiles            : "belongs to"
  departments                 ||--o{ faculty_profiles            : "belongs to"
  departments                 ||--o{ admin_profiles              : "belongs to"
  departments                 ||--o{ subjects                    : "owns"
  departments                 ||--o{ geofence_zones              : "owns"
  departments                 }o--|| users                       : "headed by"

  terms                       ||--o{ classes                     : "contains"
  terms                       ||--o{ faculty_sessions            : "contains"
  terms                       ||--o{ attendance_records          : "contains"

  subjects                    ||--o{ classes                     : "offered as"
  classes                     ||--o{ enrollments                 : "has"
  classes                     ||--o{ faculty_sessions            : "has"
  classes                     ||--o{ attendance_records          : "has"

  geofence_zones              ||--o{ faculty_sessions            : "used by"

  faculty_sessions            ||--o{ dynamic_qr_sessions         : "has"
  faculty_sessions            ||--o{ attendance_records          : "has"
  faculty_sessions            ||--o{ face_verification_attempts  : "has"
  faculty_sessions            ||--o{ location_verification_attempts : "has"
  faculty_sessions            ||--o{ manual_override_requests    : "has"

  dynamic_qr_sessions         ||--o{ attendance_records          : "used in"

  face_enrollments            ||--o{ face_verification_attempts  : "verified by"

  face_verification_attempts  ||--o| attendance_records          : "linked to"
  location_verification_attempts ||--o| attendance_records       : "linked to"

  manual_override_requests    ||--o| attendance_records          : "results in"
```

---

## Index Reference

### Why each index exists

| Table | Index | Columns | Reason |
|-------|-------|---------|--------|
| departments | idx_departments_code | code | Registration validation — check if dept code exists |
| departments | idx_departments_active | is_active (partial) | Dropdown lists — only active departments |
| terms | idx_terms_active | is_active (partial) | Find current term in O(1) |
| terms | idx_terms_dates | start_date, end_date | Date-range queries for term listing |
| users | idx_users_email | email | Login — most frequent query on this table |
| users | idx_users_role | role | Admin user-management filter by role |
| users | idx_users_status | status (partial) | Filter active users in all queries |
| users | idx_users_deleted_at | deleted_at (partial) | Soft-delete filter on every query |
| student_profiles | idx_student_profiles_student_id | student_id | Look up by institutional ID |
| student_profiles | idx_student_profiles_department | department_id | List students in a department |
| student_profiles | idx_student_profiles_batch | batch_year | Cohort analytics |
| faculty_profiles | idx_faculty_profiles_faculty_id | faculty_id | Look up by institutional ID |
| faculty_profiles | idx_faculty_profiles_department | department_id | List faculty in a department |
| parent_student_links | idx_psl_parent | parent_user_id (partial) | Parent dashboard — find all linked students |
| parent_student_links | idx_psl_student | student_user_id (partial) | Student settings — find all linked parents |
| subjects | idx_subjects_code | code | Session creation form — subject lookup |
| subjects | idx_subjects_department | department_id (partial) | List subjects by department |
| classes | idx_classes_faculty | faculty_user_id (partial) | Faculty dashboard — my classes |
| classes | idx_classes_term | term_id (partial) | Admin analytics — classes this term |
| classes | idx_classes_subject | subject_id (partial) | Subject management |
| enrollments | idx_enrollments_student | student_user_id (partial) | Student dashboard — my classes |
| enrollments | idx_enrollments_class | class_id (partial) | Faculty — class roster |
| enrollments | idx_enrollments_status | status | Filter active/dropped enrollments |
| geofence_zones | idx_geofence_zones_center | center_point (GIST) | ST_DWithin proximity queries |
| geofence_zones | idx_geofence_zones_boundary | boundary (GIST, partial) | ST_Within polygon containment |
| geofence_zones | idx_geofence_zones_dept | department_id (partial) | Zone picker by department |
| geofence_zones | idx_geofence_zones_active | is_active (partial) | Active zones dropdown |
| faculty_sessions | idx_fs_faculty | faculty_user_id (partial) | Faculty dashboard — my sessions |
| faculty_sessions | idx_fs_class | class_id (partial) | Class management |
| faculty_sessions | idx_fs_term | term_id (partial) | Term-level analytics |
| faculty_sessions | idx_fs_status | status (partial) | Active sessions for attendance |
| faculty_sessions | idx_fs_scheduled | scheduled_start, scheduled_end | Today's sessions, upcoming sessions |
| faculty_sessions | idx_fs_location | location_point (GIST) | Proximity queries |
| dynamic_qr_sessions | idx_qr_session_active | faculty_session_id, status (partial) | Find current QR for a session |
| dynamic_qr_sessions | idx_qr_expires_at | expires_at (partial) | Background expiry sweep |
| dynamic_qr_sessions | idx_qr_nonce | nonce | Replay attack detection |
| face_enrollments | idx_fe_user_active | user_id, is_active (partial) | Find enrollment on every attendance attempt |
| face_enrollments | idx_fe_expires | expires_at (partial) | Re-enrollment reminder job |
| face_enrollments | idx_fe_external_id | external_face_id (partial) | Cloud provider sync |
| face_verification_attempts | idx_fva_session | faculty_session_id | Faculty review of face checks |
| face_verification_attempts | idx_fva_student | student_user_id | Dispute resolution |
| face_verification_attempts | idx_fva_result | result (partial) | Security monitoring — failures |
| face_verification_attempts | idx_fva_time | attempted_at | Rate-limit checks, recent attempts |
| attendance_records | idx_ar_student | student_user_id (partial) | Student history — most frequent |
| attendance_records | idx_ar_session | faculty_session_id (partial) | Faculty live view |
| attendance_records | idx_ar_class | class_id (partial) | Class-level analytics |
| attendance_records | idx_ar_term | term_id (partial) | Term-level analytics |
| attendance_records | idx_ar_status | status | Present/late/absent counts |
| attendance_records | idx_ar_override | is_manual_override (partial) | Admin override review |
| attendance_records | idx_ar_student_class | student_user_id, class_id (partial) | Attendance % calculation |
| location_verification_attempts | idx_lva_point | student_point (GIST) | Heat-map, proximity analysis |
| location_verification_attempts | idx_lva_session | faculty_session_id | Session location review |
| location_verification_attempts | idx_lva_student | student_user_id | Dispute resolution |
| location_verification_attempts | idx_lva_spoof | spoofing_detected (partial) | Security monitoring |
| location_verification_attempts | idx_lva_time | attempted_at | Time-based queries |
| device_sessions | idx_ds_user_active | user_id, is_active (partial) | Session management page |
| device_sessions | idx_ds_token_hash | refresh_token_hash | Token refresh — every request |
| device_sessions | idx_ds_expires | expires_at (partial) | Expiry sweep job |
| device_sessions | idx_ds_ip | ip_address | Security — IP-based queries |
| notifications | idx_notif_recipient_unread | recipient_id, status (partial) | Notification bell count |
| notifications | idx_notif_pending | status, created_at (partial) | Delivery worker queue |
| notifications | idx_notif_failed | status, retry_count (partial) | Retry worker queue |
| audit_logs | idx_al_user | user_id (partial) | User activity timeline |
| audit_logs | idx_al_resource | resource_type, resource_id | All changes to a resource |
| audit_logs | idx_al_action | action | Filter by action type |
| audit_logs | idx_al_time | created_at DESC | Admin audit log viewer |
| audit_logs | idx_al_failed | success (partial) | Security monitoring |
| audit_logs | idx_al_ip | ip_address (partial) | Brute-force detection |
| manual_override_requests | idx_mor_pending | status (partial) | Admin review queue |
| manual_override_requests | idx_mor_session | faculty_session_id (partial) | Session override list |
| manual_override_requests | idx_mor_requester | requested_by (partial) | Faculty's own requests |
| manual_override_requests | idx_mor_student | student_user_id (partial) | Student dispute history |

---

## Enumeration Types

| Type | Values |
|------|--------|
| user_role | student, faculty, admin, parent |
| user_status | active, inactive, suspended, pending_verification |
| term_type | semester, trimester, quarter, annual |
| term_status | upcoming, active, completed, archived |
| session_type | lecture, lab, tutorial, seminar, workshop, exam |
| session_status | scheduled, active, completed, cancelled |
| enrollment_status | enrolled, dropped, completed, waitlisted |
| attendance_status | present, late, absent, excused |
| verification_step | qr_scan, face_verification, geofence_check |
| verification_result | passed, failed, error, skipped |
| qr_status | active, expired, revoked, used |
| notification_type | absence_alert, low_attendance, session_started, manual_override, system_alert, parent_alert, account_activity |
| notification_channel | in_app, email, sms |
| notification_status | pending, sent, delivered, failed, read |
| audit_action | login, logout, register, password_reset, profile_update, face_enrolled, face_updated, face_deleted, session_created, session_started, session_ended, session_cancelled, qr_generated, qr_refreshed, attendance_marked, attendance_failed, manual_override_requested, manual_override_approved, manual_override_rejected, user_created, user_updated, user_deactivated, role_changed, parent_linked, parent_unlinked, data_exported, data_deleted |
| override_status | pending, approved, rejected, auto_approved |
| device_platform | web, ios, android, unknown |

---

## PostGIS Columns

| Table | Column | Type | Purpose |
|-------|--------|------|---------|
| geofence_zones | center_point | GEOGRAPHY(POINT, 4326) | Zone centre for ST_DWithin radius check |
| geofence_zones | boundary | GEOGRAPHY(POLYGON, 4326) | Irregular zone shape for ST_Within check |
| faculty_sessions | location_point | GEOGRAPHY(POINT, 4326) | Session location for geofence calculation |
| location_verification_attempts | student_point | GEOGRAPHY(POINT, 4326) | Student's reported location at check time |

All spatial columns use **GEOGRAPHY** (not GEOMETRY) so that `ST_Distance` returns metres on a spherical earth model without requiring a projection.

---

## Triggers

| Trigger | Table | Event | Purpose |
|---------|-------|-------|---------|
| trg_*_updated_at | all tables with updated_at | BEFORE UPDATE | Auto-set updated_at = NOW() |
| trg_qr_revoke_previous | dynamic_qr_sessions | AFTER INSERT | Revoke all previous active QRs for the session |
| trg_sync_attendance_counts | attendance_records | AFTER INSERT/UPDATE/DELETE | Keep faculty_sessions.present/late/absent_count in sync |
| trg_deactivate_old_face_enrollment | face_enrollments | AFTER INSERT | Deactivate previous enrollment when new one is created |

---

## Views

| View | Purpose |
|------|---------|
| v_student_attendance_summary | Pre-aggregated attendance % per student per class per term |
| v_active_sessions | All currently active sessions with subject and faculty info |
| v_current_qr | Active QR token for each active session |

---

## Soft-Delete Policy

Tables with `deleted_at`:

| Table | Reason |
|-------|--------|
| users | Preserve audit trail and attendance history |
| departments | Preserve historical class/subject references |
| student_profiles | Preserve enrollment and attendance history |
| parent_student_links | Preserve link history for audit |
| subjects | Preserve class and enrollment history |
| classes | Preserve enrollment and attendance history |
| enrollments | Preserve attendance history |
| geofence_zones | Preserve session history |
| faculty_sessions | Preserve attendance records |
| face_enrollments | GDPR right-to-erasure (soft-delete preserves audit trail) |
| attendance_records | Admin corrections — preserve original record |
| manual_override_requests | Preserve override history |

Tables **without** soft-delete (append-only or hard-delete appropriate):

| Table | Reason |
|-------|--------|
| audit_logs | Immutable — never delete |
| face_verification_attempts | Immutable forensic log |
| location_verification_attempts | Immutable forensic log |
| dynamic_qr_sessions | Status field handles lifecycle |
| device_sessions | Revoked via is_active flag |
| notifications | Status field handles lifecycle |
| terms | Hard-delete only if no classes exist |
