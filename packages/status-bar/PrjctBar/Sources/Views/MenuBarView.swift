// MenuBarView.swift
// Main popover view for the status bar app

import SwiftUI

struct MenuBarView: View {
    @EnvironmentObject var appState: AppState
    @State private var quickInputText = ""
    @State private var showProjectPicker = false
    
    var body: some View {
        VStack(spacing: 0) {
            // Header with project selector
            headerView
            
            Divider()
            
            // Quick input bar
            quickInputBar
            
            Divider()
            
            // Main content
            ScrollView {
                VStack(spacing: 16) {
                    // Current Focus Section
                    currentFocusSection
                    
                    // Quick Actions
                    if appState.currentTask != nil {
                        quickActionsBar
                    }
                    
                    Divider()
                        .padding(.horizontal)
                    
                    // Queue Section
                    queueSection
                    
                    Divider()
                        .padding(.horizontal)
                    
                    // Ideas Section
                    ideasSection
                    
                    Divider()
                        .padding(.horizontal)
                    
                    // Stats Section
                    statsSection
                }
                .padding(.vertical, 12)
            }
            
            Divider()
            
            // Footer
            footerView
        }
        .frame(width: 380, height: 520)
        .background(Color(NSColor.windowBackgroundColor))
    }
    
    // MARK: - Header
    
    private var headerView: some View {
        HStack {
            Image(systemName: "sparkle")
                .foregroundColor(.orange)
                .font(.system(size: 16, weight: .semibold))
            
            Text("prjct")
                .font(.system(size: 14, weight: .semibold))
            
            Spacer()
            
            // Project Selector
            Button(action: { showProjectPicker.toggle() }) {
                HStack(spacing: 4) {
                    Text(appState.currentProject?.name ?? "No Project")
                        .font(.system(size: 12))
                        .foregroundColor(.secondary)
                    Image(systemName: "chevron.down")
                        .font(.system(size: 10))
                        .foregroundColor(.secondary)
                }
            }
            .buttonStyle(.plain)
            .popover(isPresented: $showProjectPicker) {
                ProjectPickerView()
                    .environmentObject(appState)
            }
            
            // Connection indicator
            Circle()
                .fill(appState.isConnected ? Color.green : Color.red)
                .frame(width: 6, height: 6)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }
    
    // MARK: - Quick Input
    
    private var quickInputBar: some View {
        HStack(spacing: 8) {
            Image(systemName: "text.cursor")
                .foregroundColor(.secondary)
                .font(.system(size: 12))
            
            TextField("What are you working on?", text: $quickInputText)
                .textFieldStyle(.plain)
                .font(.system(size: 13))
                .onSubmit {
                    handleQuickInput()
                }
            
            if !quickInputText.isEmpty {
                Button(action: handleQuickInput) {
                    Image(systemName: "arrow.up.circle.fill")
                        .foregroundColor(.orange)
                        .font(.system(size: 18))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(Color(NSColor.controlBackgroundColor))
    }
    
    // MARK: - Current Focus
    
    private var currentFocusSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label("Current Focus", systemImage: "target")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(.secondary)
                
                Spacer()
                
                if let task = appState.currentTask, let startedAt = task.startedAt {
                    Text(formatDuration(from: startedAt))
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(.orange)
                }
            }
            
            if let task = appState.currentTask {
                VStack(alignment: .leading, spacing: 4) {
                    Text(task.description)
                        .font(.system(size: 14, weight: .medium))
                        .lineLimit(2)
                    
                    HStack(spacing: 8) {
                        if let featureId = task.featureId {
                            Label(featureId, systemImage: "tag")
                                .font(.system(size: 10))
                                .foregroundColor(.secondary)
                        }
                        
                        if let sessionId = task.sessionId {
                            Label("Session active", systemImage: "bolt.fill")
                                .font(.system(size: 10))
                                .foregroundColor(.green)
                        }
                    }
                }
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.orange.opacity(0.1))
                .cornerRadius(8)
            } else if let paused = appState.pausedTask {
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Image(systemName: "pause.circle.fill")
                            .foregroundColor(.yellow)
                        Text("Paused")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(.yellow)
                    }
                    
                    Text(paused.description)
                        .font(.system(size: 14, weight: .medium))
                        .lineLimit(2)
                    
                    if let reason = paused.pauseReason {
                        Text(reason)
                            .font(.system(size: 11))
                            .foregroundColor(.secondary)
                    }
                    
                    Button(action: {
                        Task { await appState.resumeTask() }
                    }) {
                        Label("Resume", systemImage: "play.fill")
                            .font(.system(size: 12, weight: .medium))
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.orange)
                    .controlSize(.small)
                    .padding(.top, 4)
                }
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.yellow.opacity(0.1))
                .cornerRadius(8)
            } else {
                VStack(spacing: 8) {
                    Image(systemName: "moon.zzz")
                        .font(.system(size: 24))
                        .foregroundColor(.secondary)
                    Text("No active task")
                        .font(.system(size: 12))
                        .foregroundColor(.secondary)
                    Text("Start one from the queue below")
                        .font(.system(size: 11))
                        .foregroundColor(.secondary.opacity(0.7))
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 20)
            }
        }
        .padding(.horizontal, 16)
    }
    
    // MARK: - Quick Actions
    
    private var quickActionsBar: some View {
        HStack(spacing: 12) {
            ActionButton(
                title: "Done",
                icon: "checkmark.circle.fill",
                color: .green
            ) {
                Task { await appState.completeCurrentTask() }
            }
            
            ActionButton(
                title: "Pause",
                icon: "pause.circle.fill",
                color: .yellow
            ) {
                Task { await appState.pauseCurrentTask() }
            }
            
            ActionButton(
                title: "Idea",
                icon: "lightbulb.fill",
                color: .purple
            ) {
                appState.showQuickCapture = true
            }
            
            ActionButton(
                title: "Ship",
                icon: "paperplane.fill",
                color: .orange
            ) {
                // Show ship dialog
            }
        }
        .padding(.horizontal, 16)
    }
    
    // MARK: - Queue
    
    private var queueSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label("Up Next", systemImage: "list.bullet")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(.secondary)
                
                Spacer()
                
                Text("\(appState.queue.filter { $0.completed != true }.count) tasks")
                    .font(.system(size: 10))
                    .foregroundColor(.secondary)
            }
            
            let activeTasks = appState.queue.filter { $0.section == "active" && $0.completed != true }.prefix(4)
            
            if activeTasks.isEmpty {
                Text("Queue is empty")
                    .font(.system(size: 12))
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
            } else {
                ForEach(Array(activeTasks.enumerated()), id: \.element.id) { index, task in
                    QueueItemRow(task: task, index: index + 1) {
                        Task { await appState.startTask(task) }
                    }
                }
            }
        }
        .padding(.horizontal, 16)
    }
    
    // MARK: - Ideas
    
    private var ideasSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label("Ideas", systemImage: "lightbulb")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(.secondary)
                
                Spacer()
                
                let pendingCount = appState.ideas.filter { $0.status == "pending" }.count
                Text("\(pendingCount) pending")
                    .font(.system(size: 10))
                    .foregroundColor(.secondary)
            }
            
            let recentIdeas = appState.ideas.filter { $0.status == "pending" }.prefix(3)
            
            if recentIdeas.isEmpty {
                Text("No pending ideas")
                    .font(.system(size: 12))
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
            } else {
                ForEach(Array(recentIdeas), id: \.id) { idea in
                    IdeaRow(idea: idea)
                }
            }
        }
        .padding(.horizontal, 16)
    }
    
    // MARK: - Stats
    
    private var statsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Stats", systemImage: "chart.bar")
                .font(.system(size: 11, weight: .semibold))
                .foregroundColor(.secondary)
            
            HStack(spacing: 16) {
                StatItem(
                    value: "\(appState.stats?.tasksToday ?? 0)",
                    label: "Today",
                    icon: "checkmark.circle"
                )
                
                StatItem(
                    value: "\(appState.stats?.tasksThisWeek ?? 0)",
                    label: "Week",
                    icon: "calendar"
                )
                
                StatItem(
                    value: "\(appState.stats?.streak ?? 0)",
                    label: "Streak",
                    icon: "flame"
                )
                
                StatItem(
                    value: "\(appState.shipped.count)",
                    label: "Shipped",
                    icon: "paperplane"
                )
            }
            .frame(maxWidth: .infinity)
        }
        .padding(.horizontal, 16)
    }
    
    // MARK: - Footer
    
    private var footerView: some View {
        HStack {
            Button(action: {}) {
                Image(systemName: "gear")
                    .font(.system(size: 12))
            }
            .buttonStyle(.plain)
            .foregroundColor(.secondary)
            
            Spacer()
            
            if let lastSync = appState.lastSync {
                Text("Synced \(formatTimeAgo(lastSync))")
                    .font(.system(size: 10))
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            Text("⌘⇧P")
                .font(.system(size: 10, weight: .medium))
                .foregroundColor(.secondary)
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(Color.secondary.opacity(0.2))
                .cornerRadius(4)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
    }
    
    // MARK: - Helpers
    
    private func handleQuickInput() {
        guard !quickInputText.isEmpty else { return }
        
        // Detect if it's an idea (starts with "idea:" or "💡")
        if quickInputText.lowercased().hasPrefix("idea:") || quickInputText.hasPrefix("💡") {
            let text = quickInputText
                .replacingOccurrences(of: "idea:", with: "", options: .caseInsensitive)
                .replacingOccurrences(of: "💡", with: "")
                .trimmingCharacters(in: .whitespaces)
            
            Task {
                await appState.captureIdea(text)
            }
        } else {
            // TODO: Start as new task or add to queue
        }
        
        quickInputText = ""
    }
    
    private func formatDuration(from isoString: String) -> String {
        let formatter = ISO8601DateFormatter()
        guard let date = formatter.date(from: isoString) else { return "" }
        
        let elapsed = Date().timeIntervalSince(date)
        let hours = Int(elapsed) / 3600
        let minutes = (Int(elapsed) % 3600) / 60
        
        if hours > 0 {
            return "\(hours)h \(minutes)m"
        } else {
            return "\(minutes)m"
        }
    }
    
    private func formatTimeAgo(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}

// MARK: - Subviews

struct ActionButton: View {
    let title: String
    let icon: String
    let color: Color
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.system(size: 16))
                    .foregroundColor(color)
                Text(title)
                    .font(.system(size: 10))
                    .foregroundColor(.primary)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .background(color.opacity(0.1))
            .cornerRadius(8)
        }
        .buttonStyle(.plain)
    }
}

struct QueueItemRow: View {
    let task: PrjctTask
    let index: Int
    let onStart: () -> Void
    
    var priorityColor: Color {
        switch task.priority {
        case "critical", "high": return .red
        case "medium": return .yellow
        default: return .green
        }
    }
    
    var body: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(priorityColor)
                .frame(width: 8, height: 8)
            
            Text("\(index).")
                .font(.system(size: 11, weight: .medium))
                .foregroundColor(.secondary)
            
            Text(task.description)
                .font(.system(size: 12))
                .lineLimit(1)
            
            Spacer()
            
            Button(action: onStart) {
                Image(systemName: "play.circle")
                    .font(.system(size: 14))
                    .foregroundColor(.orange)
            }
            .buttonStyle(.plain)
            .opacity(0.7)
        }
        .padding(.vertical, 4)
    }
}

struct IdeaRow: View {
    let idea: Idea
    
    var priorityColor: Color {
        switch idea.priority {
        case "high": return .red
        case "low": return .gray
        default: return .purple
        }
    }
    
    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "lightbulb")
                .font(.system(size: 10))
                .foregroundColor(priorityColor)
            
            Text(idea.text)
                .font(.system(size: 12))
                .lineLimit(1)
            
            Spacer()
            
            ForEach(idea.tags.prefix(2), id: \.self) { tag in
                Text("#\(tag)")
                    .font(.system(size: 9))
                    .foregroundColor(.secondary)
            }
        }
        .padding(.vertical, 2)
    }
}

struct StatItem: View {
    let value: String
    let label: String
    let icon: String
    
    var body: some View {
        VStack(spacing: 2) {
            HStack(spacing: 2) {
                Image(systemName: icon)
                    .font(.system(size: 10))
                    .foregroundColor(.secondary)
                Text(value)
                    .font(.system(size: 14, weight: .semibold))
            }
            Text(label)
                .font(.system(size: 9))
                .foregroundColor(.secondary)
        }
    }
}

struct ProjectPickerView: View {
    @EnvironmentObject var appState: AppState
    @Environment(\.dismiss) var dismiss
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Select Project")
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(.secondary)
                .padding(.horizontal, 12)
                .padding(.top, 8)
            
            Divider()
            
            ForEach(appState.projects) { project in
                Button(action: {
                    Task {
                        await appState.selectProject(project)
                    }
                    dismiss()
                }) {
                    HStack {
                        Circle()
                            .fill(project.id == appState.currentProject?.id ? Color.orange : Color.secondary.opacity(0.3))
                            .frame(width: 8, height: 8)
                        
                        Text(project.name)
                            .font(.system(size: 12))
                        
                        Spacer()
                        
                        if project.currentTask != nil {
                            Image(systemName: "bolt.fill")
                                .font(.system(size: 10))
                                .foregroundColor(.green)
                        }
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
            
            Divider()
            
            Button(action: {}) {
                Label("Add Project", systemImage: "plus")
                    .font(.system(size: 12))
            }
            .buttonStyle(.plain)
            .foregroundColor(.orange)
            .padding(.horizontal, 12)
            .padding(.bottom, 8)
        }
        .frame(width: 200)
    }
}

struct SettingsView: View {
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        Form {
            Section("General") {
                Toggle("Launch at login", isOn: .constant(true))
                Toggle("Show in Dock", isOn: .constant(false))
            }
            
            Section("Notifications") {
                Toggle("Task completed", isOn: .constant(true))
                Toggle("Feature shipped", isOn: .constant(true))
                Toggle("Long session reminder", isOn: .constant(true))
            }
            
            Section("Server") {
                TextField("Port", text: .constant("3478"))
            }
        }
        .padding()
        .frame(width: 400, height: 300)
    }
}

#Preview {
    MenuBarView()
        .environmentObject(AppState.shared)
}
