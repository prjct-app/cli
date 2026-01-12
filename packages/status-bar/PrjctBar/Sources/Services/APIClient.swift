// APIClient.swift
// HTTP client for communicating with prjct server

import Foundation

actor APIClient {
    static let shared = APIClient()
    
    private let baseURL: URL
    private let session: URLSession
    private let decoder: JSONDecoder
    
    private init() {
        // Default to localhost:3478
        let port = UserDefaults.standard.integer(forKey: "serverPort")
        let actualPort = port > 0 ? port : 3478
        self.baseURL = URL(string: "http://localhost:\(actualPort)")!
        
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 10
        config.timeoutIntervalForResource = 30
        self.session = URLSession(configuration: config)
        
        self.decoder = JSONDecoder()
        self.decoder.keyDecodingStrategy = .convertFromSnakeCase
    }
    
    // MARK: - Projects
    
    func getProjects() async throws -> [Project] {
        let url = baseURL.appendingPathComponent("/api/projects")
        let (data, _) = try await session.data(from: url)
        
        struct Response: Codable {
            let projects: [Project]
        }
        
        let response = try decoder.decode(Response.self, from: data)
        return response.projects
    }
    
    func getProjectDashboard(_ projectId: String) async throws -> ProjectDashboard {
        let url = baseURL.appendingPathComponent("/api/projects/\(projectId)/full")
        let (data, _) = try await session.data(from: url)
        return try decoder.decode(ProjectDashboard.self, from: data)
    }
    
    // MARK: - Tasks
    
    func completeTask(projectId: String) async throws {
        let url = baseURL.appendingPathComponent("/api/projects/\(projectId)/task/complete")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let (_, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw APIError.requestFailed
        }
    }
    
    func pauseTask(projectId: String, reason: String? = nil) async throws {
        let url = baseURL.appendingPathComponent("/api/projects/\(projectId)/task/pause")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if let reason = reason {
            let body = ["reason": reason]
            request.httpBody = try JSONEncoder().encode(body)
        }
        
        let (_, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw APIError.requestFailed
        }
    }
    
    func resumeTask(projectId: String) async throws {
        let url = baseURL.appendingPathComponent("/api/projects/\(projectId)/task/resume")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        
        let (_, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw APIError.requestFailed
        }
    }
    
    func startTask(projectId: String, taskId: String) async throws {
        let url = baseURL.appendingPathComponent("/api/projects/\(projectId)/queue/start")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body = ["taskId": taskId]
        request.httpBody = try JSONEncoder().encode(body)
        
        let (_, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw APIError.requestFailed
        }
    }
    
    // MARK: - Ideas
    
    func captureIdea(projectId: String, text: String, priority: String = "medium", tags: [String] = []) async throws {
        let url = baseURL.appendingPathComponent("/api/projects/\(projectId)/ideas")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "text": text,
            "priority": priority,
            "tags": tags
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (_, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw APIError.requestFailed
        }
    }
    
    // MARK: - Health Check
    
    func healthCheck() async -> Bool {
        let url = baseURL.appendingPathComponent("/health")
        do {
            let (_, response) = try await session.data(from: url)
            return (response as? HTTPURLResponse)?.statusCode == 200
        } catch {
            return false
        }
    }
}

// MARK: - Errors

enum APIError: LocalizedError {
    case requestFailed
    case decodingFailed
    case serverNotRunning
    
    var errorDescription: String? {
        switch self {
        case .requestFailed:
            return "Request failed"
        case .decodingFailed:
            return "Failed to decode response"
        case .serverNotRunning:
            return "prjct server is not running. Run 'prjct server' to start it."
        }
    }
}
