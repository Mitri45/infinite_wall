import AppKit
import Darwin
import Foundation

private struct SuccessPayload: Encodable {
    let ok = true
    let displayCount: Int
}

private struct FailurePayload: Encodable {
    let ok = false
    let domain: String
    let code: Int
    let description: String
    let failureReason: String?
    let displayIndex: Int?
    let displayName: String?
    let completedDisplayCount: Int
    let totalDisplayCount: Int
}

@main
private struct WallpaperHelper {
    static func main() {
        guard Thread.isMainThread else {
            fail(
                error: helperError(
                    code: 1,
                    description: "The wallpaper helper was not started on its main thread."
                ),
                completedDisplayCount: 0,
                totalDisplayCount: 0
            )
        }
        guard CommandLine.arguments.count == 2 else {
            fail(
                error: helperError(
                    code: 2,
                    description: "The wallpaper helper requires one image path."
                ),
                completedDisplayCount: 0,
                totalDisplayCount: 0
            )
        }

        let imageURL = URL(
            fileURLWithPath: CommandLine.arguments[1],
            isDirectory: false
        )
        guard imageURL.isFileURL,
              FileManager.default.fileExists(atPath: imageURL.path),
              NSImage(contentsOf: imageURL) != nil else {
            fail(
                error: helperError(
                    code: 3,
                    description: "The wallpaper image could not be read or decoded."
                ),
                completedDisplayCount: 0,
                totalDisplayCount: 0
            )
        }

        let screens = NSScreen.screens
        guard !screens.isEmpty else {
            fail(
                error: helperError(
                    code: 4,
                    description: "macOS did not report any available displays."
                ),
                completedDisplayCount: 0,
                totalDisplayCount: 0
            )
        }

        let workspace = NSWorkspace.shared
        for (index, screen) in screens.enumerated() {
            do {
                try workspace.setDesktopImageURL(
                    imageURL,
                    for: screen,
                    options: [:]
                )
            } catch {
                fail(
                    error: error as NSError,
                    screen: screen,
                    displayIndex: index + 1,
                    completedDisplayCount: index,
                    totalDisplayCount: screens.count
                )
            }
        }

        writeJSON(
            SuccessPayload(displayCount: screens.count),
            to: .standardOutput
        )
    }
}

private func helperError(code: Int, description: String) -> NSError {
    NSError(
        domain: "InfiniteWallWallpaperHelper",
        code: code,
        userInfo: [NSLocalizedDescriptionKey: description]
    )
}

private func fail(
    error: NSError,
    screen: NSScreen? = nil,
    displayIndex: Int? = nil,
    completedDisplayCount: Int,
    totalDisplayCount: Int
) -> Never {
    let displayName = screen?.localizedName
    writeJSON(
        FailurePayload(
            domain: error.domain,
            code: error.code,
            description: error.localizedDescription,
            failureReason: error.localizedFailureReason,
            displayIndex: displayIndex,
            displayName: displayName,
            completedDisplayCount: completedDisplayCount,
            totalDisplayCount: totalDisplayCount
        ),
        to: .standardError
    )
    Darwin.exit(1)
}

private func writeJSON<Value: Encodable>(
    _ value: Value,
    to handle: FileHandle
) {
    do {
        let data = try JSONEncoder().encode(value)
        handle.write(data)
        handle.write(Data([0x0a]))
    } catch {
        handle.write(
            Data(
                "{\"ok\":false,\"domain\":\"InfiniteWallWallpaperHelper\",\"code\":5,\"description\":\"The helper response could not be encoded.\",\"completedDisplayCount\":0,\"totalDisplayCount\":0}\n".utf8
            )
        )
    }
}
