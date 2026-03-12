// FinWise iOS Widget — SwiftUI
// Requires iOS 16+ / Xcode 14+
//
// HOW TO ADD:
// 1. In Xcode: File → New → Target → Widget Extension
// 2. Replace the default widget code with this file
// 3. Set your API base URL in FinWiseAPI.baseURL
// 4. Add a "Widget Extension" capability to your app target
// 5. Build & run on device or simulator

import SwiftUI
import WidgetKit

// ── API Model ──────────────────────────────────────────────────────────────

struct FinWiseData: Codable {
    let totalBalance: Double
    let monthIncome: Double
    let monthExpense: Double
    let streak: Int
    let level: Int
    let totalXp: Int
}

// ── API Service ────────────────────────────────────────────────────────────

struct FinWiseAPI {
    // Change this to your deployed backend URL
    static let baseURL = "https://your-finwise-backend.com"

    static func fetchData() async -> FinWiseData? {
        guard let url = URL(string: "\(baseURL)/api/widget/summary") else { return nil }
        do {
            let (data, response) = try await URLSession.shared.data(from: url)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else { return nil }
            return try JSONDecoder().decode(FinWiseData.self, from: data)
        } catch {
            print("FinWise Widget fetch error:", error)
            return nil
        }
    }
}

// ── Timeline Provider ──────────────────────────────────────────────────────

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> SimpleEntry {
        SimpleEntry(date: .now, data: FinWiseData(
            totalBalance: 85_400,
            monthIncome: 120_000,
            monthExpense: 48_200,
            streak: 7,
            level: 3,
            totalXp: 650
        ))
    }

    func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> Void) {
        Task {
            let data = await FinWiseAPI.fetchData() ?? placeholder(in: context).data
            completion(SimpleEntry(date: .now, data: data))
        }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SimpleEntry>) -> Void) {
        Task {
            let data = await FinWiseAPI.fetchData()
            let entry = SimpleEntry(date: .now, data: data ?? placeholder(in: context).data)
            // Refresh every 15 minutes
            let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: .now)!
            completion(Timeline(entries: [entry], policy: .after(nextUpdate)))
        }
    }
}

struct SimpleEntry: TimelineEntry {
    let date: Date
    let data: FinWiseData
}

// ── Widget Views ───────────────────────────────────────────────────────────

struct FinWiseWidgetSmall: View {
    let data: FinWiseData

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Image(systemName: "chart.bar.fill")
                    .foregroundColor(.green)
                    .font(.system(size: 14, weight: .semibold))
                Text("FinWise")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(.primary)
            }

            Spacer()

            Text(formatRub(data.totalBalance))
                .font(.system(size: 22, weight: .bold, design: .rounded))
                .foregroundColor(.primary)

            Text("Общий баланс")
                .font(.system(size: 11))
                .foregroundColor(.secondary)

            HStack(spacing: 8) {
                Label("\(data.streak)", systemImage: "bolt.fill")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(.yellow)
                Text("Lv.\(data.level)")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(.green)
            }
        }
        .padding(14)
        .background(
            LinearGradient(
                colors: [Color(.systemBackground), Color.green.opacity(0.05)],
                startPoint: .topLeading, endPoint: .bottomTrailing
            )
        )
    }
}

struct FinWiseWidgetMedium: View {
    let data: FinWiseData

    var body: some View {
        HStack(spacing: 16) {
            // Left: balance
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Image(systemName: "chart.bar.fill").foregroundColor(.green)
                    Text("FinWise").font(.system(size: 14, weight: .semibold))
                }
                Spacer()
                Text(formatRub(data.totalBalance))
                    .font(.system(size: 24, weight: .bold, design: .rounded))
                Text("Баланс")
                    .font(.system(size: 11))
                    .foregroundColor(.secondary)
            }

            Divider()

            // Right: month stats
            VStack(alignment: .leading, spacing: 8) {
                statRow(icon: "arrow.down.circle.fill", color: .green,
                        label: "Доходы", value: formatRub(data.monthIncome))
                statRow(icon: "arrow.up.circle.fill", color: .red,
                        label: "Расходы", value: formatRub(data.monthExpense))

                HStack {
                    Image(systemName: "bolt.fill").foregroundColor(.yellow).font(.system(size: 12))
                    Text("\(data.streak) дней подряд · Ур. \(data.level)")
                        .font(.system(size: 11))
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding(14)
    }

    func statRow(icon: String, color: Color, label: String, value: String) -> some View {
        HStack(spacing: 6) {
            Image(systemName: icon).foregroundColor(color).font(.system(size: 13))
            VStack(alignment: .leading, spacing: 1) {
                Text(label).font(.system(size: 10)).foregroundColor(.secondary)
                Text(value).font(.system(size: 13, weight: .semibold))
            }
        }
    }
}

// ── Widget Entry View (router) ─────────────────────────────────────────────

struct FinWiseWidgetEntryView: View {
    var entry: Provider.Entry
    @Environment(\.widgetFamily) var family

    var body: some View {
        switch family {
        case .systemSmall:
            FinWiseWidgetSmall(data: entry.data)
        case .systemMedium:
            FinWiseWidgetMedium(data: entry.data)
        default:
            FinWiseWidgetSmall(data: entry.data)
        }
    }
}

// ── Widget Configuration ───────────────────────────────────────────────────

@main
struct FinWiseWidget: Widget {
    let kind: String = "FinWiseWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            FinWiseWidgetEntryView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("FinWise Баланс")
        .description("Текущий баланс, доходы и расходы за месяц.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

// ── Helpers ────────────────────────────────────────────────────────────────

func formatRub(_ amount: Double) -> String {
    let formatter = NumberFormatter()
    formatter.numberStyle = .currency
    formatter.currencyCode = "RUB"
    formatter.maximumFractionDigits = 0
    formatter.locale = Locale(identifier: "ru_RU")
    return formatter.string(from: NSNumber(value: amount)) ?? "—"
}
