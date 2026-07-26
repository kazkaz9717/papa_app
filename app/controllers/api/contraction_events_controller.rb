module Api
  class ContractionEventsController < BaseController
    # GET /api/contraction_events
    # 直近の記録一覧 ＋ 統計（回数・平均間隔・病院連絡の目安）を返す
    def index
      render json: {
        # 新しい順に最大30件を、画面用の形（event_json）に変換して返す
        events: current_household.contraction_events.recent_first.limit(30).map { |e| event_json(e) },
        # モデルの stats に「その家族の全記録」を渡して統計を計算
        stats: ContractionEvent.stats(all_events)
      }
    end

    # POST /api/contraction_events
    # 「陣痛が来た」ボタンの記録。1件保存して、最新の統計を返す
    def create
      event = current_household.contraction_events.create!(
        # 時刻が渡されていればそれを、無ければ「今」を使う
        occurred_at: params[:occurred_at].presence || Time.current,
        # 記録した人＝今ログインしている人
        recorded_by: current_user
      )
      render json: {
        event: event_json(event),
        stats: ContractionEvent.stats(all_events) # 記録後の最新統計
      }, status: :created
    end

    # DELETE /api/contraction_events/:id
    # 間違えて記録したときの取り消し。1件消して、更新後の統計を返す
    def destroy
      current_household.contraction_events.find(params[:id]).destroy!
      render json: { stats: ContractionEvent.stats(all_events) }
    end

    private

    # その家族の全記録を古い順の配列で取得（統計計算に渡す用）
    def all_events
      current_household.contraction_events.chronological.to_a
    end

    # 1件の記録を、画面に返す形に整える
    def event_json(event)
      {
        id: event.id,
        occurred_at: event.occurred_at,
        recorded_by: event.recorded_by&.name # 記録した人の名前（未設定なら nil）
      }
    end
  end
end