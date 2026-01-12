// HotkeyService.swift
// Global keyboard shortcuts using Carbon API

import Cocoa
import Carbon

class HotkeyService {
    static let shared = HotkeyService()
    
    private var hotkeys: [Hotkey: () -> Void] = [:]
    private var hotkeyRefs: [Hotkey: EventHotKeyRef?] = [:]
    private var eventHandler: EventHandlerRef?
    
    enum Hotkey: CaseIterable {
        case togglePanel    // ⌘⇧P
        case quickCapture   // ⌘⇧N
        case completeTask   // ⌘⇧D
        case switchProject  // ⌘⇧S
        
        var keyCode: UInt32 {
            switch self {
            case .togglePanel: return UInt32(kVK_ANSI_P)
            case .quickCapture: return UInt32(kVK_ANSI_N)
            case .completeTask: return UInt32(kVK_ANSI_D)
            case .switchProject: return UInt32(kVK_ANSI_S)
            }
        }
        
        var modifiers: UInt32 {
            // ⌘⇧ = cmdKey + shiftKey
            return UInt32(cmdKey | shiftKey)
        }
        
        var id: UInt32 {
            switch self {
            case .togglePanel: return 1
            case .quickCapture: return 2
            case .completeTask: return 3
            case .switchProject: return 4
            }
        }
        
        var description: String {
            switch self {
            case .togglePanel: return "⌘⇧P - Toggle Panel"
            case .quickCapture: return "⌘⇧N - Quick Capture"
            case .completeTask: return "⌘⇧D - Complete Task"
            case .switchProject: return "⌘⇧S - Switch Project"
            }
        }
    }
    
    private init() {
        setupEventHandler()
    }
    
    deinit {
        unregisterAll()
    }
    
    // MARK: - Registration
    
    func register(_ hotkey: Hotkey, handler: @escaping () -> Void) {
        hotkeys[hotkey] = handler
        registerHotkey(hotkey)
    }
    
    func unregister(_ hotkey: Hotkey) {
        hotkeys.removeValue(forKey: hotkey)
        if let ref = hotkeyRefs[hotkey], let hotkeyRef = ref {
            UnregisterEventHotKey(hotkeyRef)
            hotkeyRefs.removeValue(forKey: hotkey)
        }
    }
    
    func unregisterAll() {
        for hotkey in Hotkey.allCases {
            unregister(hotkey)
        }
    }
    
    // MARK: - Private
    
    private func setupEventHandler() {
        var eventType = EventTypeSpec(
            eventClass: OSType(kEventClassKeyboard),
            eventKind: UInt32(kEventHotKeyPressed)
        )
        
        let handler: EventHandlerUPP = { _, event, userData -> OSStatus in
            guard let userData = userData else { return OSStatus(eventNotHandledErr) }
            let service = Unmanaged<HotkeyService>.fromOpaque(userData).takeUnretainedValue()
            
            var hotkeyID = EventHotKeyID()
            let err = GetEventParameter(
                event,
                EventParamName(kEventParamDirectObject),
                EventParamType(typeEventHotKeyID),
                nil,
                MemoryLayout<EventHotKeyID>.size,
                nil,
                &hotkeyID
            )
            
            guard err == noErr else { return OSStatus(eventNotHandledErr) }
            
            // Find and execute handler
            for hotkey in Hotkey.allCases where hotkey.id == hotkeyID.id {
                if let handler = service.hotkeys[hotkey] {
                    DispatchQueue.main.async {
                        handler()
                    }
                    return noErr
                }
            }
            
            return OSStatus(eventNotHandledErr)
        }
        
        let unmanagedSelf = Unmanaged.passUnretained(self).toOpaque()
        InstallEventHandler(
            GetApplicationEventTarget(),
            handler,
            1,
            &eventType,
            unmanagedSelf,
            &eventHandler
        )
    }
    
    private func registerHotkey(_ hotkey: Hotkey) {
        var hotkeyID = EventHotKeyID(
            signature: OSType(0x50524A43), // "PRJC"
            id: hotkey.id
        )
        
        var hotkeyRef: EventHotKeyRef?
        
        let status = RegisterEventHotKey(
            hotkey.keyCode,
            hotkey.modifiers,
            hotkeyID,
            GetApplicationEventTarget(),
            0,
            &hotkeyRef
        )
        
        if status == noErr {
            hotkeyRefs[hotkey] = hotkeyRef
            print("[Hotkey] Registered: \(hotkey.description)")
        } else {
            print("[Hotkey] Failed to register: \(hotkey.description)")
        }
    }
}
