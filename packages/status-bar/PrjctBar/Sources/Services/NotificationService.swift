// NotificationService.swift
// Native macOS notifications for prjct events

import Foundation
import UserNotifications

class NotificationService: NSObject, UNUserNotificationCenterDelegate {
    static let shared = NotificationService()
    
    private override init() {
        super.init()
        setupNotifications()
    }
    
    // MARK: - Setup
    
    private func setupNotifications() {
        let center = UNUserNotificationCenter.current()
        center.delegate = self
        
        // Request permission
        center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
            if granted {
                print("[Notifications] Permission granted")
            } else if let error = error {
                print("[Notifications] Permission error: \(error.localizedDescription)")
            }
        }
        
        // Register categories with actions
        let completeAction = UNNotificationAction(
            identifier: "COMPLETE_ACTION",
            title: "Complete",
            options: .foreground
        )
        
        let pauseAction = UNNotificationAction(
            identifier: "PAUSE_ACTION",
            title: "Pause",
            options: []
        )
        
        let taskCategory = UNNotificationCategory(
            identifier: "TASK_CATEGORY",
            actions: [completeAction, pauseAction],
            intentIdentifiers: [],
            options: []
        )
        
        let ideaAction = UNNotificationAction(
            identifier: "VIEW_IDEAS_ACTION",
            title: "View Ideas",
            options: .foreground
        )
        
        let ideaCategory = UNNotificationCategory(
            identifier: "IDEA_CATEGORY",
            actions: [ideaAction],
            intentIdentifiers: [],
            options: []
        )
        
        center.setNotificationCategories([taskCategory, ideaCategory])
    }
    
    // MARK: - Notifications
    
    func showTaskCompleted(_ taskName: String) {
        guard UserDefaults.standard.bool(forKey: "notifications.taskComplete") != false else { return }
        
        let content = UNMutableNotificationContent()
        content.title = "Task Completed ✅"
        content.body = taskName
        content.sound = .default
        content.categoryIdentifier = "TASK_CATEGORY"
        
        show(content, id: "task-completed-\(Date().timeIntervalSince1970)")
    }
    
    func showFeatureShipped(_ featureName: String) {
        guard UserDefaults.standard.bool(forKey: "notifications.shipped") != false else { return }
        
        let content = UNMutableNotificationContent()
        content.title = "🚀 Feature Shipped!"
        content.body = featureName
        content.sound = UNNotificationSound(named: UNNotificationSoundName("celebration.aiff"))
        
        show(content, id: "feature-shipped-\(Date().timeIntervalSince1970)")
    }
    
    func showIdeaCaptured(_ ideaText: String) {
        let content = UNMutableNotificationContent()
        content.title = "💡 Idea Captured"
        content.body = ideaText
        content.sound = nil // Silent
        content.categoryIdentifier = "IDEA_CATEGORY"
        
        show(content, id: "idea-captured-\(Date().timeIntervalSince1970)")
    }
    
    func showLongSessionReminder(duration: String) {
        guard UserDefaults.standard.bool(forKey: "notifications.longSession") != false else { return }
        
        let content = UNMutableNotificationContent()
        content.title = "⏰ Long Session"
        content.body = "You've been working for \(duration). Consider taking a break!"
        content.sound = .default
        
        show(content, id: "long-session-\(Date().timeIntervalSince1970)")
    }
    
    func showStreakMilestone(days: Int) {
        let content = UNMutableNotificationContent()
        content.title = "🔥 Streak Milestone!"
        content.body = "You've shipped for \(days) days in a row!"
        content.sound = .default
        
        show(content, id: "streak-\(days)")
    }
    
    // MARK: - Private
    
    private func show(_ content: UNMutableNotificationContent, id: String) {
        let request = UNNotificationRequest(
            identifier: id,
            content: content,
            trigger: nil // Immediate
        )
        
        UNUserNotificationCenter.current().add(request) { error in
            if let error = error {
                print("[Notifications] Error: \(error.localizedDescription)")
            }
        }
    }
    
    // MARK: - UNUserNotificationCenterDelegate
    
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        switch response.actionIdentifier {
        case "COMPLETE_ACTION":
            Task {
                await AppState.shared.completeCurrentTask()
            }
        case "PAUSE_ACTION":
            Task {
                await AppState.shared.pauseCurrentTask()
            }
        case "VIEW_IDEAS_ACTION":
            AppState.shared.selectedTab = .ideas
        default:
            break
        }
        
        completionHandler()
    }
    
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        // Show notification even when app is in foreground
        completionHandler([.banner, .sound])
    }
}
