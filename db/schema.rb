# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[7.2].define(version: 2026_09_05_060150) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "plpgsql"

  create_table "benefit_steps", force: :cascade do |t|
    t.bigint "household_id", null: false
    t.integer "position", default: 0, null: false
    t.string "phase_label", null: false
    t.string "title", null: false
    t.text "description"
    t.string "status", default: "todo", null: false
    t.string "timing_note"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "url"
    t.bigint "updated_by_id"
    t.index ["household_id", "position"], name: "index_benefit_steps_on_household_id_and_position"
    t.index ["household_id"], name: "index_benefit_steps_on_household_id"
    t.index ["updated_by_id"], name: "index_benefit_steps_on_updated_by_id"
  end

  create_table "checklist_items", force: :cascade do |t|
    t.bigint "household_id", null: false
    t.string "category", null: false
    t.string "title", null: false
    t.string "detail"
    t.string "place"
    t.date "due_on"
    t.string "url"
    t.integer "position", default: 0, null: false
    t.boolean "done", default: false, null: false
    t.bigint "done_by_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "created_by_id"
    t.index ["created_by_id"], name: "index_checklist_items_on_created_by_id"
    t.index ["done_by_id"], name: "index_checklist_items_on_done_by_id"
    t.index ["household_id", "category", "position"], name: "idx_on_household_id_category_position_00487edb03"
    t.index ["household_id"], name: "index_checklist_items_on_household_id"
  end

  create_table "contraction_events", force: :cascade do |t|
    t.bigint "household_id", null: false
    t.datetime "occurred_at", null: false
    t.bigint "recorded_by_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["household_id", "occurred_at"], name: "index_contraction_events_on_household_id_and_occurred_at"
    t.index ["household_id"], name: "index_contraction_events_on_household_id"
    t.index ["recorded_by_id"], name: "index_contraction_events_on_recorded_by_id"
  end

  create_table "households", force: :cascade do |t|
    t.string "name"
    t.date "due_on"
    t.date "birth_on"
    t.string "baby_name"
    t.string "invite_code"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.boolean "guest", default: false, null: false
    t.string "custom_log_labels", default: ["", "", "", ""], null: false, array: true
    t.index ["invite_code"], name: "index_households_on_invite_code", unique: true
  end

  create_table "log_entries", force: :cascade do |t|
    t.bigint "household_id", null: false
    t.string "kind", null: false
    t.datetime "occurred_at", null: false
    t.bigint "recorded_by_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.text "note"
    t.integer "amount"
    t.text "memo"
    t.integer "duration_sec"
    t.integer "breast_ml"
    t.integer "formula_ml"
    t.decimal "temperature", precision: 4, scale: 1
    t.index ["household_id"], name: "index_log_entries_on_household_id"
    t.index ["recorded_by_id"], name: "index_log_entries_on_recorded_by_id"
  end

  create_table "users", force: :cascade do |t|
    t.bigint "household_id", null: false
    t.string "name"
    t.string "email"
    t.string "password_digest"
    t.string "api_token"
    t.string "role"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.boolean "owner", default: false, null: false
    t.string "tile_order", default: [], null: false, array: true
    t.index ["api_token"], name: "index_users_on_api_token", unique: true
    t.index ["email"], name: "index_users_on_email", unique: true
    t.index ["household_id"], name: "index_users_on_household_id"
  end

  add_foreign_key "benefit_steps", "households"
  add_foreign_key "benefit_steps", "users", column: "updated_by_id"
  add_foreign_key "checklist_items", "households"
  add_foreign_key "checklist_items", "users", column: "created_by_id"
  add_foreign_key "checklist_items", "users", column: "done_by_id"
  add_foreign_key "contraction_events", "households"
  add_foreign_key "contraction_events", "users", column: "recorded_by_id"
  add_foreign_key "log_entries", "households"
  add_foreign_key "log_entries", "users", column: "recorded_by_id"
  add_foreign_key "users", "households"
end
