Rails.application.routes.draw do
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check

  # Render dynamic PWA files from app/views/pwa/*
  get "service-worker" => "rails/pwa#service_worker", as: :pwa_service_worker
  get "manifest" => "rails/pwa#manifest", as: :pwa_manifest

  # Defines the root path route ("/")
  # root "posts#index"

  namespace :api do
    post "signup", to: "auth#signup"
    post "login",  to: "auth#login"
    post "guest_login", to: "auth#guest_login"
    get  "me",     to: "auth#me"
    resources :checklist_items, only: %i[index create update destroy]
    # 陣痛の記録：一覧・記録・取り消し ＋ リセット
    resources :contraction_events, only: %i[index create destroy] do
      collection { delete :reset }
    end
    # 育休・給付金ステップ：一覧・状態変更
    resources :benefit_steps, only: %i[index update]
    resources :log_entries, only: %i[index create update destroy]
    resource :household, only: %i[show update], controller: "household"
    get   "household/custom_log_labels", to: "household#custom_log_labels"
    patch "household/custom_log_labels", to: "household#update_custom_log_labels"
    delete "household/members/:id", to: "household#remove_member"
    post "household/regenerate_invite_code", to: "household#regenerate_invite_code"
  end
end