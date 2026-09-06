module Api
  class LogEntriesController < BaseController
    def index
      date = params[:date].present? ? Date.parse(params[:date]) : Date.current
      scope = current_household.log_entries.for_date(date)
      render json: {
        date: date.iso8601,
        entries: scope.recent_first.map { |e| entry_json(e) },
        summary: summary_for(scope)
      }
    rescue ArgumentError
      render json: { error: "日付の形式が正しくありません" }, status: :unprocessable_entity
    end

    def create
      entry = current_household.log_entries.create!(
        kind: params[:kind],
        note: params[:note],
        amount: params[:amount].presence,
        memo: params[:memo].presence,
        duration_sec: params[:duration_sec].presence,
        breast_ml: params[:breast_ml].presence,
        formula_ml: params[:formula_ml].presence,
        temperature: params[:temperature].presence,
        left_duration_sec: params[:left_duration_sec].presence,
        right_duration_sec: params[:right_duration_sec].presence,
        occurred_at: params[:occurred_at].presence || Time.current,
        recorded_by: current_user
      )
      render json: {
        entry: entry_json(entry),
        summary: summary_for(current_household.log_entries.for_date(entry.occurred_at.to_date))
      }, status: :created
    rescue ActiveRecord::RecordInvalid => e
      render json: { error: e.record.errors.full_messages.join("、") }, status: :unprocessable_entity
    end

    def update
      entry = current_household.log_entries.find(params[:id])
      entry.update!(
        occurred_at: params[:occurred_at].presence || entry.occurred_at,
        amount: params[:amount].presence,
        memo: params[:memo].presence,
        duration_sec: params[:duration_sec].presence,
        breast_ml: params[:breast_ml].presence,
        formula_ml: params[:formula_ml].presence,
        temperature: params[:temperature].presence,
        left_duration_sec: params[:left_duration_sec].presence,
        right_duration_sec: params[:right_duration_sec].presence
      )
      render json: {
        entry: entry_json(entry),
        summary: summary_for(current_household.log_entries.for_date(entry.occurred_at.to_date))
      }
    rescue ActiveRecord::RecordInvalid => e
      render json: { error: e.record.errors.full_messages.join("、") }, status: :unprocessable_entity
    end

    def destroy
      current_household.log_entries.find(params[:id]).destroy!
      render json: { summary: summary_for(current_household.log_entries.today) }
    end

    private

    def summary_for(scope)
      breastfeeding = scope.where(kind: "breastfeeding")
      bottle = scope.where(kind: "bottle")

      left_count = breastfeeding.where("left_duration_sec > 0").count
      right_count = breastfeeding.where("right_duration_sec > 0").count
      left_seconds = breastfeeding.sum(:left_duration_sec)
      right_seconds = breastfeeding.sum(:right_duration_sec)

      {
        breastfeeding: {
          left: { count: left_count, seconds: left_seconds },
          right: { count: right_count, seconds: right_seconds },
          total: { count: left_count + right_count, seconds: left_seconds + right_seconds }
        },
        bottle: {
          count: bottle.count,
          breast_ml: bottle.sum(:breast_ml),
          formula_ml: bottle.sum(:formula_ml)
        },
        toilet: {
          pee: scope.where(kind: %w[pee both]).count,
          poop: scope.where(kind: %w[poop both]).count
        }
      }
    end

    def entry_json(entry)
      {
        id: entry.id,
        kind: entry.kind,
        note: entry.note,
        amount: entry.amount,
        memo: entry.memo,
        duration_sec: entry.duration_sec,
        breast_ml: entry.breast_ml,
        formula_ml: entry.formula_ml,
        temperature: entry.temperature,
        left_duration_sec: entry.left_duration_sec,
        right_duration_sec: entry.right_duration_sec,
        occurred_at: entry.occurred_at,
        recorded_by: entry.recorded_by&.name,
        recorded_by_role: entry.recorded_by_role
      }
    end
  end
end