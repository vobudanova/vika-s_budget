// Генерация iOS launch-экранов (apple-touch-startup-image) для standalone-режима.
//
// Сплэш повторяет скелет загрузки дашборда (src/app/(app)/loading.tsx):
// шапка «Вика.Salmon» + skeleton-плейсхолдеры — запуск бесшовно переходит
// в настоящий загрузочный экран.
//
// Запуск (нужен Golos Text SemiBold для шапки):
//   curl -s -o /tmp/golos-600.ttf "$(curl -s 'https://fonts.googleapis.com/css2?family=Golos+Text:wght@600' | grep -o 'https://fonts.gstatic.com[^)]*')"
//   swift scripts/gen-splash.swift /tmp/golos-600.ttf
// Результат: public/splash/apple-splash-{W}x{H}.png (медиа-запросы — в layout.tsx)

import AppKit
import CoreText

// (логическая ширина, высота, dpr, высота статус-бара в pt)
let DEVICES: [(Double, Double, Double, Double)] = [
  (375, 667, 2, 20),  // SE 2/3
  (414, 736, 3, 20),  // 8 Plus
  (375, 812, 3, 50),  // X/XS/11 Pro/12-13 mini
  (414, 896, 2, 48),  // XR/11
  (414, 896, 3, 48),  // XS Max/11 Pro Max
  (390, 844, 3, 47),  // 12/13/14
  (393, 852, 3, 59),  // 14 Pro/15/16
  (402, 874, 3, 62),  // 16 Pro/17/17 Pro — статус-бар выше, чем у 15/16
  (420, 912, 3, 62),  // Air
  (428, 926, 3, 47),  // 12/13 Pro Max/14 Plus
  (430, 932, 3, 59),  // 14 Pro Max/15 Plus/15 Pro Max/16 Plus
  (440, 956, 3, 62),  // 16 Pro Max/17 Pro Max
]

let scriptURL = URL(fileURLWithPath: CommandLine.arguments[0])
let root = scriptURL.deletingLastPathComponent().deletingLastPathComponent()
let outDir = root.appendingPathComponent("public/splash")
try? FileManager.default.createDirectory(at: outDir, withIntermediateDirectories: true)

guard CommandLine.arguments.count > 1 else { fatalError("путь к golos-600.ttf первым аргументом") }
var ferr: Unmanaged<CFError>?
CTFontManagerRegisterFontsForURL(URL(fileURLWithPath: CommandLine.arguments[1]) as CFURL, .process, &ferr)

func rgb(_ hex: UInt32) -> NSColor {
  NSColor(srgbRed: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255,
          blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
}
let paper = rgb(0xFAF7F5), card = NSColor.white, cardBorder = rgb(0xEDE7E3)
let skel = rgb(0xE9EDF0), dark8 = rgb(0x1F1F1F), salmon = rgb(0xD14A3C), grayIcon = rgb(0x49_50_57)

for (lw, lh, dpr, statusH) in DEVICES {
  let W = Int(lw * dpr), H = Int(lh * dpr)
  let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: W, pixelsHigh: H, bitsPerSample: 8,
    samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB,
    bytesPerRow: 0, bitsPerPixel: 0)!
  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
  let t = NSAffineTransform(); t.scale(by: dpr); t.concat()

  // координаты: top — от верхнего края (макетные), рисуем в неперевёрнутой системе
  func bar(_ x: Double, _ top: Double, _ w: Double, _ h: Double, _ r: Double, _ c: NSColor) {
    c.setFill()
    NSBezierPath(roundedRect: NSRect(x: x, y: lh - top - h, width: w, height: h), xRadius: r, yRadius: r).fill()
  }
  func cardBox(_ top: Double, _ h: Double, _ x: Double, _ w: Double) {
    let rect = NSRect(x: x + 0.5, y: lh - top - h + 0.5, width: w - 1, height: h - 1)
    let p = NSBezierPath(roundedRect: rect, xRadius: 16, yRadius: 16)
    card.setFill(); p.fill(); cardBorder.setStroke(); p.lineWidth = 1; p.stroke()
  }

  paper.setFill()
  NSRect(x: 0, y: 0, width: lw, height: lh).fill()

  // — без шапки: строка «бургер + логотип» в потоке страницы —
  let headC = statusH + 16 + 12
  for i in -1...1 {  // бургер size=sm
    bar(16, headC - 1 + Double(i) * 5.5, 18, 2, 1, dark8)
  }
  let brandFont = NSFont(name: "Golos Text SemiBold", size: 17) ?? NSFont(name: "GolosText-SemiBold", size: 17)!
  let brand = NSMutableAttributedString()
  brand.append(NSAttributedString(string: "Вика", attributes: [.font: brandFont, .foregroundColor: dark8, .kern: -0.34]))
  brand.append(NSAttributedString(string: ".Salmon", attributes: [.font: brandFont, .foregroundColor: salmon, .kern: -0.34]))
  // draw(at:) — нижний левый угол bounding box; центрируем полосу капов на headC
  brand.draw(at: NSPoint(x: 46, y: lh - headC - brandFont.capHeight / 2 + brandFont.descender))

  // — скелет дашборда: как в src/app/(app)/loading.tsx —
  // приветствие по центру + круглая кнопка справа, сумма, 6 квадратных плиток
  let x = 16.0, cw = lw - 32
  var y = headC + 12 + 12 + 10
  bar((lw - 210) / 2, y + 11, 210, 24, 8, skel)            // «Привет, Виктория!»
  bar(lw - 8 - 46, y, 46, 46, 23, skel)                    // круглая кнопка нового дня
  y += 46 + 32
  bar((lw - 190) / 2, y, 190, 34, 8, skel)                 // баланс
  y += 34 + 32
  let tile = (cw - 16) / 2                                 // плитки: 2 в ряд, gap md
  for row in 0..<3 {
    let ty = y + Double(row) * (tile + 16)
    if ty > lh { break }
    bar(x, ty, tile, tile, 16, skel)
    bar(x + tile + 16, ty, tile, tile, 16, skel)
  }

  NSGraphicsContext.current?.flushGraphics()
  NSGraphicsContext.restoreGraphicsState()
  let name = "apple-splash-\(W)x\(H).png"
  try! rep.representation(using: .png, properties: [:])!.write(to: outDir.appendingPathComponent(name))
  print("\(name)  \(W)x\(H)")
}
