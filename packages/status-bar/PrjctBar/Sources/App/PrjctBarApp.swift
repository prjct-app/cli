// PrjctBarApp.swift
// Main entry point for prjct-bar macOS status bar app

import SwiftUI

@main
struct PrjctBarApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @StateObject private var appState = AppState.shared
    
    var body: some Scene {
        Settings {
            SettingsView()
                .environmentObject(appState)
        }
    }
}

// MARK: - App Delegate
class AppDelegate: NSObject, NSApplicationDelegate {
    private var statusItem: NSStatusItem!
    private var popover: NSPopover!
    private var eventMonitor: Any?
    
    func applicationDidFinishLaunching(_ notification: Notification) {
        setupStatusItem()
        setupPopover()
        setupEventMonitor()
        setupHotkeys()
        
        // Start SSE connection
        SSEClient.shared.connect()
        
        // Hide dock icon
        NSApp.setActivationPolicy(.accessory)
    }
    
    // MARK: - Setup
    
    private func setupStatusItem() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        
        if let button = statusItem.button {
            button.image = NSImage(systemSymbolName: "sparkle", accessibilityDescription: "prjct")
            button.image?.isTemplate = true
            button.action = #selector(togglePopover)
            button.target = self
        }
        
        // Update icon based on state
        updateStatusIcon()
    }
    
    private func setupPopover() {
        popover = NSPopover()
        popover.contentSize = NSSize(width: 380, height: 520)
        popover.behavior = .transient
        popover.animates = true
        popover.contentViewController = NSHostingController(
            rootView: MenuBarView()
                .environmentObject(AppState.shared)
        )
    }
    
    private func setupEventMonitor() {
        eventMonitor = NSEvent.addGlobalMonitorForEvents(matching: [.leftMouseDown, .rightMouseDown]) { [weak self] _ in
            if let popover = self?.popover, popover.isShown {
                popover.performClose(nil)
            }
        }
    }
    
    private func setupHotkeys() {
        HotkeyService.shared.register(.togglePanel) { [weak self] in
            self?.togglePopover()
        }
        
        HotkeyService.shared.register(.quickCapture) {
            AppState.shared.showQuickCapture = true
        }
        
        HotkeyService.shared.register(.completeTask) {
            Task {
                await AppState.shared.completeCurrentTask()
            }
        }
    }
    
    // MARK: - Actions
    
    @objc private func togglePopover() {
        guard let button = statusItem.button else { return }
        
        if popover.isShown {
            popover.performClose(nil)
        } else {
            popover.show(relativeTo: button.bounds, of: button, preferredEdge: .minY)
            popover.contentViewController?.view.window?.makeKey()
        }
    }
    
    func updateStatusIcon() {
        guard let button = statusItem.button else { return }
        
        let state = AppState.shared
        
        if state.currentTask != nil {
            // Active task - show with indicator
            button.image = NSImage(systemSymbolName: "sparkle", accessibilityDescription: "prjct - active")
            button.contentTintColor = NSColor.systemOrange
        } else if state.pausedTask != nil {
            // Paused task
            button.image = NSImage(systemSymbolName: "pause.circle", accessibilityDescription: "prjct - paused")
            button.contentTintColor = NSColor.systemYellow
        } else {
            // Idle
            button.image = NSImage(systemSymbolName: "sparkle", accessibilityDescription: "prjct")
            button.contentTintColor = nil
        }
    }
}
