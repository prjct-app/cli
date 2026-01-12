// AppState.swift
// Global application state management

import SwiftUI
import Combine

@MainActor
class AppState: ObservableObject {
    static let shared = AppState()
    
    // MARK: - Published State
    
    @Published var projects: [Project] = []
    @Published var currentProject: Project?
    @Published var currentTask: PrjctTask?
    @Published var pausedTask: PrjctTask?
    @Published var queue: [PrjctTask] = []
    @Published var ideas: [Idea] = []
    @Published var shipped: [ShippedFeature] = []
    @Published var stats: ProjectStats?
    
    // UI State
    @Published var isLoading = false
    @Published var error: String?
    @Published var showQuickCapture = false
    @Published var selectedTab: Tab = .focus
    
    // Connection State
    @Published var isConnected = false
    @Published var lastSync: Date?
    
    // MARK: - Types
    
    enum Tab: String, CaseIterable {
        case focus = "Focus"
        case queue = "Queue"
        case ideas = "Ideas"
        case shipped = "Shipped"
    }
    
    // MARK: - Initialization
    
    private init() {
        // Load initial data
        Task {
            await loadProjects()
        }
    }
    
    // MARK: - Data Loading
    
    func loadProjects() async {
        isLoading = true
        defer { isLoading = false }
        
        do {
            projects = try await APIClient.shared.getProjects()
            
            // Auto-select first project if none selected
            if currentProject == nil, let first = projects.first {
                await selectProject(first)
            }
        } catch {
            self.error = error.localizedDescription
        }
    }
    
    func selectProject(_ project: Project) async {
        currentProject = project
        await refreshCurrentProject()
    }
    
    func refreshCurrentProject() async {
        guard let project = currentProject else { return }
        
        isLoading = true
        defer { isLoading = false }
        
        do {
            let dashboard = try await APIClient.shared.getProjectDashboard(project.id)
            
            currentTask = dashboard.state?.currentTask
            pausedTask = dashboard.state?.previousTask
            queue = dashboard.queue?.tasks ?? []
            ideas = dashboard.ideas?.ideas ?? []
            shipped = dashboard.shipped?.shipped ?? []
            stats = dashboard.stats
            lastSync = Date()
        } catch {
            self.error = error.localizedDescription
        }
    }
    
    // MARK: - Actions
    
    func completeCurrentTask() async {
        guard let project = currentProject else { return }
        
        do {
            try await APIClient.shared.completeTask(projectId: project.id)
            await refreshCurrentProject()
            
            // Show notification
            NotificationService.shared.showTaskCompleted(currentTask?.description ?? "Task")
        } catch {
            self.error = error.localizedDescription
        }
    }
    
    func pauseCurrentTask(reason: String? = nil) async {
        guard let project = currentProject else { return }
        
        do {
            try await APIClient.shared.pauseTask(projectId: project.id, reason: reason)
            await refreshCurrentProject()
        } catch {
            self.error = error.localizedDescription
        }
    }
    
    func resumeTask() async {
        guard let project = currentProject else { return }
        
        do {
            try await APIClient.shared.resumeTask(projectId: project.id)
            await refreshCurrentProject()
        } catch {
            self.error = error.localizedDescription
        }
    }
    
    func captureIdea(_ text: String, priority: String = "medium", tags: [String] = []) async {
        guard let project = currentProject else { return }
        
        do {
            try await APIClient.shared.captureIdea(
                projectId: project.id,
                text: text,
                priority: priority,
                tags: tags
            )
            await refreshCurrentProject()
            
            // Show notification
            NotificationService.shared.showIdeaCaptured(text)
        } catch {
            self.error = error.localizedDescription
        }
    }
    
    func startTask(_ task: PrjctTask) async {
        guard let project = currentProject else { return }
        
        do {
            try await APIClient.shared.startTask(projectId: project.id, taskId: task.id)
            await refreshCurrentProject()
        } catch {
            self.error = error.localizedDescription
        }
    }
    
    // MARK: - SSE Event Handling
    
    func handleSSEEvent(_ event: SSEEvent) {
        Task { @MainActor in
            switch event.type {
            case "task:started", "task:completed", "task:paused", "task:resumed":
                await refreshCurrentProject()
            case "idea:captured":
                await refreshCurrentProject()
            case "feature:shipped":
                await refreshCurrentProject()
                if let name = event.data?["name"] as? String {
                    NotificationService.shared.showFeatureShipped(name)
                }
            case "connected":
                isConnected = true
            case "heartbeat":
                lastSync = Date()
            default:
                break
            }
        }
    }
}

// MARK: - Models

struct Project: Identifiable, Codable {
    let id: String
    let name: String
    let path: String?
    var currentTask: PrjctTask?
    var stats: ProjectStats?
}

struct PrjctTask: Identifiable, Codable {
    let id: String
    let description: String
    let startedAt: String?
    let sessionId: String?
    let featureId: String?
    let priority: String?
    let type: String?
    let section: String?
    let completed: Bool?
    let pausedAt: String?
    let pauseReason: String?
}

struct Idea: Identifiable, Codable {
    let id: String
    let text: String
    let status: String
    let priority: String
    let tags: [String]
    let addedAt: String
    let convertedTo: String?
}

struct ShippedFeature: Identifiable, Codable {
    let id: String
    let name: String
    let description: String?
    let version: String?
    let shippedAt: String
    let duration: String?
}

struct ProjectStats: Codable {
    let tasksToday: Int?
    let tasksThisWeek: Int?
    let streak: Int?
    let velocity: String?
    let avgDuration: String?
    let shippedCount: Int?
    let ideasCount: Int?
}

struct ProjectDashboard: Codable {
    let id: String
    let state: StateData?
    let queue: QueueData?
    let ideas: IdeasData?
    let shipped: ShippedData?
    let stats: ProjectStats?
    
    struct StateData: Codable {
        let currentTask: PrjctTask?
        let previousTask: PrjctTask?
        let lastUpdated: String?
    }
    
    struct QueueData: Codable {
        let tasks: [PrjctTask]
        let lastUpdated: String?
    }
    
    struct IdeasData: Codable {
        let ideas: [Idea]
        let lastUpdated: String?
    }
    
    struct ShippedData: Codable {
        let shipped: [ShippedFeature]
        let lastUpdated: String?
    }
}

struct SSEEvent {
    let type: String
    let data: [String: Any]?
}
