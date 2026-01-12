// SSEClient.swift
// Server-Sent Events client for real-time updates

import Foundation

class SSEClient: NSObject, URLSessionDataDelegate {
    static let shared = SSEClient()
    
    private var eventSource: URLSessionDataTask?
    private var session: URLSession!
    private var buffer = ""
    private var reconnectAttempts = 0
    private let maxReconnectAttempts = 5
    private var reconnectTimer: Timer?
    
    var onEvent: ((SSEEvent) -> Void)?
    var onConnect: (() -> Void)?
    var onDisconnect: (() -> Void)?
    
    private override init() {
        super.init()
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = TimeInterval.infinity
        config.timeoutIntervalForResource = TimeInterval.infinity
        session = URLSession(configuration: config, delegate: self, delegateQueue: .main)
    }
    
    // MARK: - Connection
    
    func connect() {
        guard eventSource == nil else { return }
        
        let port = UserDefaults.standard.integer(forKey: "serverPort")
        let actualPort = port > 0 ? port : 3478
        
        guard let url = URL(string: "http://localhost:\(actualPort)/api/events") else {
            return
        }
        
        var request = URLRequest(url: url)
        request.setValue("text/event-stream", forHTTPHeaderField: "Accept")
        request.setValue("no-cache", forHTTPHeaderField: "Cache-Control")
        
        eventSource = session.dataTask(with: request)
        eventSource?.resume()
        
        print("[SSE] Connecting to \(url)")
    }
    
    func disconnect() {
        eventSource?.cancel()
        eventSource = nil
        reconnectTimer?.invalidate()
        reconnectTimer = nil
        buffer = ""
        onDisconnect?()
        print("[SSE] Disconnected")
    }
    
    private func reconnect() {
        guard reconnectAttempts < maxReconnectAttempts else {
            print("[SSE] Max reconnect attempts reached")
            return
        }
        
        reconnectAttempts += 1
        let delay = min(pow(2.0, Double(reconnectAttempts)), 30.0)
        
        print("[SSE] Reconnecting in \(delay) seconds (attempt \(reconnectAttempts))")
        
        reconnectTimer = Timer.scheduledTimer(withTimeInterval: delay, repeats: false) { [weak self] _ in
            self?.eventSource = nil
            self?.connect()
        }
    }
    
    // MARK: - URLSessionDataDelegate
    
    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
        guard let text = String(data: data, encoding: .utf8) else { return }
        
        buffer += text
        processBuffer()
    }
    
    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        if let error = error {
            print("[SSE] Connection error: \(error.localizedDescription)")
        }
        
        eventSource = nil
        onDisconnect?()
        
        // Attempt reconnect
        reconnect()
    }
    
    // MARK: - Event Processing
    
    private func processBuffer() {
        let lines = buffer.components(separatedBy: "\n\n")
        
        // Keep the last incomplete chunk in the buffer
        if !buffer.hasSuffix("\n\n") {
            buffer = lines.last ?? ""
        } else {
            buffer = ""
        }
        
        // Process complete events
        for eventText in lines.dropLast() {
            parseEvent(eventText)
        }
        
        // If buffer was complete, process the last one too
        if buffer.isEmpty && !lines.isEmpty {
            parseEvent(lines.last!)
        }
    }
    
    private func parseEvent(_ text: String) {
        var eventType = "message"
        var eventData = ""
        
        for line in text.components(separatedBy: "\n") {
            if line.hasPrefix("event:") {
                eventType = String(line.dropFirst(6)).trimmingCharacters(in: .whitespaces)
            } else if line.hasPrefix("data:") {
                eventData = String(line.dropFirst(5)).trimmingCharacters(in: .whitespaces)
            }
        }
        
        guard !eventData.isEmpty else { return }
        
        // Parse JSON data
        var data: [String: Any]? = nil
        if let jsonData = eventData.data(using: .utf8),
           let json = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any] {
            data = json
        }
        
        let event = SSEEvent(type: eventType, data: data)
        
        // Handle special events
        switch eventType {
        case "connected":
            reconnectAttempts = 0
            onConnect?()
            print("[SSE] Connected")
        case "heartbeat":
            break // Silently handle heartbeats
        default:
            print("[SSE] Event: \(eventType)")
        }
        
        // Dispatch to AppState
        Task { @MainActor in
            AppState.shared.handleSSEEvent(event)
        }
        
        onEvent?(event)
    }
}
