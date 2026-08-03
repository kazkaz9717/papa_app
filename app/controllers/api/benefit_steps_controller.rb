module Api
  class BenefitStepsController < BaseController
    # GET /api/benefit_steps
    # 育休・給付金のステップを、並び順どおりに一覧で返す
    def index
      steps = current_household.benefit_steps.ordered
      render json: steps.map { |s| step_json(s) }
    end

    # PATCH /api/benefit_steps/:id
    # 状態（todo/doing/done）を切り替える
    def update
      step = current_household.benefit_steps.find(params[:id])
      step.update!(status: params[:status])
      render json: step_json(step)
    rescue ActiveRecord::RecordInvalid => e
      render json: { error: e.record.errors.full_messages.join("、") }, status: :unprocessable_entity
    end

    private

    def step_json(step)
      {
        id: step.id,
        position: step.position,
        phase_label: step.phase_label,
        title: step.title,
        description: step.description,
        status: step.status,
        timing_note: step.timing_note,
        url: step.url
      }
    end
  end
end