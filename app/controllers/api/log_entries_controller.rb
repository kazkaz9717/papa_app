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
        memo: params[:memo].presence
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
      {
        milk: scope.where(kind: %w[milk breast]).count,
        meal: scope.where(kind: %w[solid meal drink]).count,
        toilet: scope.where(kind: %w[pee poop both]).count,
        sleep: scope.where(kind: %w[sleep_start]).count
      }
    end

    def entry_json(entry)
      {
        id: entry.id,
        kind: entry.kind,
        note: entry.note,
        amount: entry.amount,
        memo: entry.memo,
        occurred_at: entry.occurred_at,
        recorded_by: entry.recorded_by&.name,
        recorded_by_role: entry.recorded_by&.role
      }
    end
  end
end