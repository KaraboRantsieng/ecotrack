import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FileText, Download, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

export default function Reports() {
  const [startMonth, setStartMonth] = useState(new Date(new Date().setMonth(new Date().getMonth() - 2)).toISOString().slice(0, 7));
  const [endMonth, setEndMonth] = useState(new Date().toISOString().slice(0, 7));
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportData, setReportData] = useState(null);

  const { data: allItems = [] } = useQuery({
    queryKey: ['allItems'],
    queryFn: () => base44.entities.EWasteItem.list('-created_date'),
  });

  const { data: allCollectors = [] } = useQuery({
    queryKey: ['allCollectors'],
    queryFn: () => base44.entities.User.list(),
  });

  const generateReport = async () => {
    setGeneratingReport(true);
    try {
      const [startYear, startMonthNum] = startMonth.split('-').map(Number);
      const [endYear, endMonthNum] = endMonth.split('-').map(Number);
      
      const startDate = new Date(startYear, startMonthNum - 1, 1);
      const endDate = new Date(endYear, endMonthNum, 0);

      const periodItems = allItems.filter(item => {
        const itemDate = new Date(item.created_date);
        return itemDate >= startDate && itemDate <= endDate;
      });

      // Calculate statistics
      const tonnage = periodItems.reduce((sum, item) => sum + (item.weight_kg || 0), 0) / 1000;
      const categorySplit = {};
      periodItems.forEach(item => {
        categorySplit[item.category] = (categorySplit[item.category] || 0) + (item.weight_kg || 0);
      });

      const collectorSummary = {};
      periodItems.forEach(item => {
        if (!collectorSummary[item.collector_email]) {
          collectorSummary[item.collector_email] = {
            items: 0,
            weight_kg: 0,
            co2_saved: 0
          };
        }
        collectorSummary[item.collector_email].items += item.quantity || 1;
        collectorSummary[item.collector_email].weight_kg += item.weight_kg || 0;
        collectorSummary[item.collector_email].co2_saved += item.co2_saved_kg || 0;
      });

      // Area breakdown
      const areaSummary = {};
      periodItems.forEach(item => {
        const collector = allCollectors.find(c => c.email === item.collector_email);
        const area = collector?.area || 'Unassigned';
        if (!areaSummary[area]) {
          areaSummary[area] = { items: 0, weight_kg: 0, co2_saved: 0 };
        }
        areaSummary[area].items += item.quantity || 1;
        areaSummary[area].weight_kg += item.weight_kg || 0;
        areaSummary[area].co2_saved += item.co2_saved_kg || 0;
      });

      const esgImpact = {
        co2_saved: periodItems.reduce((sum, item) => sum + (item.co2_saved_kg || 0), 0),
        hazardous_prevented: periodItems.reduce((sum, item) => sum + (item.hazardous_waste_kg || 0), 0)
      };

      // Calculate total payout (R1.50 per kg)
      const totalWeight = periodItems.reduce((sum, item) => sum + (item.weight_kg || 0), 0);
      const totalPayout = totalWeight * 1.50;

      // Calculate months in range
      const monthsDiff = (endYear - startYear) * 12 + (endMonthNum - startMonthNum) + 1;
      const periodLabel = monthsDiff === 1 
        ? `${startMonth}` 
        : `${startMonth} to ${endMonth} (${monthsDiff} months)`;

      // Use AI to generate comprehensive report
      const aiReport = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a comprehensive e-waste collection report for the period ${periodLabel}.

Data:
- Total tonnage: ${tonnage.toFixed(3)} tonnes
- Total items: ${periodItems.length}
- Category breakdown: ${JSON.stringify(categorySplit)}
- Collector summary: ${JSON.stringify(collectorSummary)}
- Area breakdown: ${JSON.stringify(areaSummary)}
- ESG Impact: CO₂ Saved: ${esgImpact.co2_saved.toFixed(2)}kg, Hazardous Prevented: ${esgImpact.hazardous_prevented.toFixed(2)}kg

Generate a professional report including:
1. Executive Summary
2. Collection Statistics
3. Category Analysis
4. Area Performance
5. Collector Performance
6. Environmental Impact (SDG alignment)
7. PRO Compliance Summary
8. Recommendations

Format as a structured report.`,
        response_json_schema: {
          type: "object",
          properties: {
            executive_summary: { type: "string" },
            collection_stats: { type: "string" },
            category_analysis: { type: "string" },
            area_performance: { type: "string" },
            collector_performance: { type: "string" },
            environmental_impact: { type: "string" },
            pro_compliance: { type: "string" },
            recommendations: { type: "string" }
          }
        }
      });

      // Collect all photos with item details
      const photoData = [];
      periodItems.forEach(item => {
        if (item.photo_urls && item.photo_urls.length > 0) {
          item.photo_urls.forEach(photoUrl => {
            photoData.push({
              url: photoUrl,
              item_code: item.item_code,
              category: item.category,
              weight_kg: item.weight_kg,
              collector_email: item.collector_email,
              location: item.location,
              verified: item.verified,
              created_date: item.created_date,
              geo_verified: item.geo_verified,
              gps_latitude: item.gps_latitude,
              gps_longitude: item.gps_longitude,
              gps_accuracy: item.gps_accuracy,
              bluetooth_verified: item.bluetooth_verified
            });
          });
        }
      });

      // Calculate audit metrics
      const verifiedItems = periodItems.filter(i => i.verified).length;
      const geoVerifiedItems = periodItems.filter(i => i.geo_verified).length;
      const bluetoothVerifiedItems = periodItems.filter(i => i.bluetooth_verified).length;
      const chainOfCustodyComplete = periodItems.filter(i => 
        i.verified && i.geo_verified && i.photo_urls && i.photo_urls.length > 0
      ).length;
      
      const auditMetrics = {
        verificationRate: periodItems.length > 0 ? (verifiedItems / periodItems.length * 100) : 0,
        gpsConfidence: periodItems.length > 0 ? (geoVerifiedItems / periodItems.length * 100) : 0,
        chainOfCustodyRate: periodItems.length > 0 ? (chainOfCustodyComplete / periodItems.length * 100) : 0,
        bluetoothVerificationRate: periodItems.length > 0 ? (bluetoothVerifiedItems / periodItems.length * 100) : 0
      };

      setReportData({
        period: periodLabel,
        startMonth,
        endMonth,
        tonnage,
        categorySplit,
        collectorSummary,
        areaSummary,
        esgImpact,
        aiReport,
        items: periodItems,
        photoData,
        totalPayout,
        auditMetrics
      });
    } catch (error) {
      console.error("Report generation error:", error);
    } finally {
      setGeneratingReport(false);
    }
  };

  const downloadReport = () => {
    if (!reportData) return;

    const csv = [
      ['EcoTrack Report', reportData.period],
      [],
      ['COLLECTION SUMMARY'],
      ['Total Tonnage (tonnes)', reportData.tonnage.toFixed(3)],
      ['Total Items', reportData.items.length],
      ['Total Payout (ZAR)', reportData.totalPayout.toFixed(2)],
      [],
      ['CATEGORY BREAKDOWN'],
      ['Category', 'Weight (kg)'],
      ...Object.entries(reportData.categorySplit).map(([cat, weight]) => [
        cat.replace(/_/g, ' '),
        weight.toFixed(2)
      ]),
      [],
      ['AREA BREAKDOWN'],
      ['Area', 'Items', 'Weight (kg)', 'CO₂ Saved (kg)'],
      ...Object.entries(reportData.areaSummary).map(([area, data]) => [
        area,
        data.items,
        data.weight_kg.toFixed(2),
        data.co2_saved.toFixed(2)
      ]),
      [],
      ['ENVIRONMENTAL IMPACT'],
      ['CO₂ Saved (kg)', reportData.esgImpact.co2_saved.toFixed(2)],
      ['Hazardous Prevented (kg)', reportData.esgImpact.hazardous_prevented.toFixed(2)],
      [],
      ['COLLECTOR SUMMARY'],
      ['Collector', 'Items', 'Weight (kg)', 'CO₂ Saved (kg)'],
      ...Object.entries(reportData.collectorSummary).map(([email, data]) => [
        email,
        data.items,
        data.weight_kg.toFixed(2),
        data.co2_saved.toFixed(2)
      ])
    ];

    const csvContent = csv.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ecotrack-report-${reportData.startMonth}-to-${reportData.endMonth}.csv`;
    a.click();
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">AI Reports</h1>
          <p className="text-gray-600">Generate reports for any period - single month or multiple months combined</p>
        </div>

        <Card className="border-none shadow-xl mb-6">
          <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50">
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-6 h-6 text-indigo-600" />
              Generate Report
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid md:grid-cols-3 gap-4 items-end">
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-2 block">
                  Start Month
                </Label>
                <input
                  type="month"
                  value={startMonth}
                  onChange={(e) => setStartMonth(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-2 block">
                  End Month
                </Label>
                <input
                  type="month"
                  value={endMonth}
                  onChange={(e) => setEndMonth(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <Button
                onClick={generateReport}
                disabled={generatingReport}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {generatingReport ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 mr-2" />
                    Generate Report
                  </>
                )}
              </Button>
            </div>
            <p className="text-sm text-gray-500 mt-3">
              Select the same month for a single month report, or different months for a combined report
            </p>
          </CardContent>
        </Card>

        {reportData && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <Card className="border-none shadow-xl">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Report Summary - {reportData.period}</CardTitle>
                <Button onClick={downloadReport} variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Download CSV
                </Button>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="mb-4 text-center">
                  <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">EPR-Verified Metrics</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="bg-indigo-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Total Tonnage</p>
                    <p className="text-3xl font-bold text-indigo-600">{reportData.tonnage.toFixed(3)}t</p>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Total Items</p>
                    <p className="text-3xl font-bold text-purple-600">{reportData.items.length}</p>
                  </div>
                  <div className="bg-emerald-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Total Payout</p>
                    <p className="text-3xl font-bold text-emerald-600">R{reportData.totalPayout.toFixed(2)}</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">CO₂ Saved</p>
                    <p className="text-3xl font-bold text-green-600">{reportData.esgImpact.co2_saved.toFixed(1)}kg</p>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Hazardous Prevented</p>
                    <p className="text-3xl font-bold text-red-600">{reportData.esgImpact.hazardous_prevented.toFixed(1)}kg</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                  <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
                    <p className="text-sm text-gray-600 mb-1">GPS Confidence</p>
                    <p className="text-3xl font-bold text-blue-600">{reportData.auditMetrics.gpsConfidence.toFixed(1)}%</p>
                  </div>
                  <div className="bg-cyan-50 p-4 rounded-lg border-2 border-cyan-200">
                    <p className="text-sm text-gray-600 mb-1">Chain-of-Custody</p>
                    <p className="text-3xl font-bold text-cyan-600">{reportData.auditMetrics.chainOfCustodyRate.toFixed(1)}%</p>
                  </div>
                  <div className="bg-teal-50 p-4 rounded-lg border-2 border-teal-200">
                    <p className="text-sm text-gray-600 mb-1">Verification Rate</p>
                    <p className="text-3xl font-bold text-teal-600">{reportData.auditMetrics.verificationRate.toFixed(1)}%</p>
                  </div>
                  <div className="bg-violet-50 p-4 rounded-lg border-2 border-violet-200">
                    <p className="text-sm text-gray-600 mb-1">Bluetooth Verified</p>
                    <p className="text-3xl font-bold text-violet-600">{reportData.auditMetrics.bluetoothVerificationRate.toFixed(1)}%</p>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-3">Executive Summary</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{reportData.aiReport.executive_summary}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-3">Area Performance</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{reportData.aiReport.area_performance}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-3">Environmental Impact</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{reportData.aiReport.environmental_impact}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-3">PRO Compliance</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{reportData.aiReport.pro_compliance}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-3">Recommendations</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{reportData.aiReport.recommendations}</p>
                </div>
              </CardContent>
            </Card>

            {reportData.photoData && reportData.photoData.length > 0 && (
              <Card className="border-none shadow-xl">
                <CardHeader>
                  <CardTitle>Collection Evidence ({reportData.photoData.length} photos)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {reportData.photoData.map((photo, idx) => (
                      <div key={idx} className="flex gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <a 
                          href={photo.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex-shrink-0"
                        >
                          <img
                            src={photo.url}
                            alt={`Collection photo ${idx + 1}`}
                            className="w-32 h-32 object-cover rounded-lg hover:opacity-90 transition-opacity"
                          />
                        </a>
                        <div className="flex-1 space-y-2">
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-gray-500">Item Code:</span>
                              <span className="ml-2 font-semibold">{photo.item_code}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Category:</span>
                              <span className="ml-2 font-semibold capitalize">{photo.category.replace(/_/g, ' ')}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Weight:</span>
                              <span className="ml-2 font-semibold">{photo.weight_kg}kg</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Collector:</span>
                              <span className="ml-2 font-semibold text-xs">{photo.collector_email}</span>
                            </div>
                            {photo.location && (
                              <div>
                                <span className="text-gray-500">Location:</span>
                                <span className="ml-2 font-semibold">{photo.location}</span>
                              </div>
                            )}
                            <div>
                              <span className="text-gray-500">Date:</span>
                              <span className="ml-2 font-semibold">{new Date(photo.created_date).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            {photo.verified && (
                              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">✓ Verified</span>
                            )}
                            {photo.geo_verified && (
                              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                                📍 GPS: {photo.gps_latitude?.toFixed(4)}, {photo.gps_longitude?.toFixed(4)} 
                                {photo.gps_accuracy && ` (±${photo.gps_accuracy.toFixed(0)}m)`}
                              </span>
                            )}
                            {photo.bluetooth_verified && (
                              <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded">🔗 Bluetooth Verified</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}