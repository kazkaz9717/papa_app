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
        temperature: params[:temperature].presence
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

    # 授乳(左右合計)・哺乳瓶(母乳/ミルクml)・排泄(おしっこ/うんち)の3分割で集計する
    def summary_for(scope)
      left = scope.where(kind: "breast_left")
      right = scope.where(kind: "breast_right")
      bottle = scope.where(kind: "bottle")

      {
        breastfeeding: {
          left: { count: left.count, seconds: left.sum(:duration_sec) },
          right: { count: right.count, seconds: right.sum(:duration_sec) },
          total: {
            count: left.count + right.count,
            seconds: left.sum(:duration_sec) + right.sum(:duration_sec)
          }
        },
        bottle: {
          count: bottle.count,
          breast_ml: bottle.sum(:breast_ml),
          formula_ml: bottle.sum(:formula_ml)
        },
        toilet: {
          # 「両方」はおしっこ・うんちの両方の回数にカウントする
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
        occurred_at: entry.occurred_at,
        recorded_by: entry.recorded_by&.name,
        recorded_by_role: entry.recorded_by&.role
      }
    end
  end
end