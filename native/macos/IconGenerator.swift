import AppKit
import Darwin
import Foundation

private struct IconVariant {
    let points: Int
    let scale: Int

    var filename: String {
        let suffix = scale == 1 ? "" : "@\(scale)x"
        return "icon_\(points)x\(points)\(suffix).png"
    }
}

private let variants = [
    IconVariant(points: 16, scale: 1),
    IconVariant(points: 16, scale: 2),
    IconVariant(points: 32, scale: 1),
    IconVariant(points: 32, scale: 2),
    IconVariant(points: 128, scale: 1),
    IconVariant(points: 128, scale: 2),
    IconVariant(points: 256, scale: 1),
    IconVariant(points: 256, scale: 2),
    IconVariant(points: 512, scale: 1),
    IconVariant(points: 512, scale: 2),
]

guard CommandLine.arguments.count == 4 else {
    fail("Usage: IconGenerator <source.svg> <fallback.png> <output.iconset>")
}

let vectorURL = URL(fileURLWithPath: CommandLine.arguments[1])
let fallbackURL = URL(fileURLWithPath: CommandLine.arguments[2])
let outputURL = URL(fileURLWithPath: CommandLine.arguments[3], isDirectory: true)
guard let sourceImage = NSImage(contentsOf: vectorURL)
    ?? NSImage(contentsOf: fallbackURL) else {
    fail("The Infinite Wall icon source could not be decoded.")
}

do {
    try FileManager.default.createDirectory(
        at: outputURL,
        withIntermediateDirectories: true
    )
    for variant in variants {
        let pixels = variant.points * variant.scale
        guard let representation = NSBitmapImageRep(
            bitmapDataPlanes: nil,
            pixelsWide: pixels,
            pixelsHigh: pixels,
            bitsPerSample: 8,
            samplesPerPixel: 4,
            hasAlpha: true,
            isPlanar: false,
            colorSpaceName: .deviceRGB,
            bytesPerRow: 0,
            bitsPerPixel: 0
        ) else {
            fail("Could not allocate the \(variant.filename) icon canvas.")
        }
        representation.size = NSSize(
            width: variant.points,
            height: variant.points
        )

        NSGraphicsContext.saveGraphicsState()
        guard let context = NSGraphicsContext(bitmapImageRep: representation)
        else {
            NSGraphicsContext.restoreGraphicsState()
            fail("Could not create the \(variant.filename) icon context.")
        }
        NSGraphicsContext.current = context
        context.imageInterpolation = .high
        sourceImage.draw(
            in: NSRect(
                x: 0,
                y: 0,
                width: variant.points,
                height: variant.points
            ),
            from: .zero,
            operation: .copy,
            fraction: 1
        )
        context.flushGraphics()
        NSGraphicsContext.restoreGraphicsState()

        guard let png = representation.representation(
            using: .png,
            properties: [:]
        ) else {
            fail("Could not encode \(variant.filename).")
        }
        try png.write(to: outputURL.appendingPathComponent(variant.filename))
    }
} catch {
    fail(error.localizedDescription)
}

private func fail(_ message: String) -> Never {
    FileHandle.standardError.write(Data("\(message)\n".utf8))
    Darwin.exit(1)
}
