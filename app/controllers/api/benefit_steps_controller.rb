module Api
  class BenefitStepsController < BaseController
    def index
      steps = current_household.benefit_steps.ordered
      render json: steps.map { |s| step_json(s) }
    end

    # ステータス変更時に、誰が変更したかを記録する
    def update
      step = current_household.benefit_steps.find(params[:id])
      step.update!(status: params[:status], updated_by: current_user)
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
        url: step.url,
        updated_by: step.updated_by&.name
      }
    end
  end
end