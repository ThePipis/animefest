#!/usr/bin/env node

import axios from 'axios';
import { performance } from 'perf_hooks';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const DEFAULT_SLUG = 'una-pareja-de-cucos-s2-latino';
const DEFAULT_EP = '1';

// Parse command line arguments
const args = process.argv.slice(2);
let slug = DEFAULT_SLUG;
let ep = DEFAULT_EP;

for (let i = 0; i < args.length; i += 2) {
  if (args[i] === '--slug' && args[i + 1]) {
    slug = args[i + 1];
  } else if (args[i] === '--ep' && args[i + 1]) {
    ep = args[i + 1];
  }
}

console.log(`🚀 Starting benchmark for ${slug}:${ep}`);
console.log(`📍 Base URL: ${BASE_URL}`);
console.log('=' .repeat(60));

async function makeRequest(url, label, timeout = 30000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const start = performance.now();
    const response = await axios.get(url, {
      signal: controller.signal,
      timeout: timeout
    });
    const end = performance.now();
    const duration = end - start;
    
    clearTimeout(timeoutId);
    
    const serverData = response.data?.data;
    const serverCount = serverData?.servers?.length || 0;
    const activeCount = serverData?.meta?.active || 0;
    const degradedCount = serverData?.meta?.degraded || 0;
    
    console.log(`✅ ${label}: ${duration.toFixed(0)}ms (${serverCount} servers: ${activeCount} active, ${degradedCount} degraded)`);
    
    return {
      duration,
      success: true,
      serverCount,
      activeCount,
      degradedCount,
      data: response.data
    };
  } catch (error) {
    clearTimeout(timeoutId);
    console.log(`❌ ${label}: FAILED - ${error.message}`);
    
    return {
      duration: timeout,
      success: false,
      error: error.message
    };
  }
}

async function clearCache() {
  try {
    await axios.delete(`${BASE_URL}/api/v1/servers/cache?slug=${slug}&ep=${ep}`);
    console.log('🗑️ Cache cleared');
  } catch (error) {
    console.warn('⚠️ Could not clear cache:', error.message);
  }
}

// Helper function to run cold tests
async function runColdTests(results) {
  console.log('\n📊 Running COLD tests (3 iterations)...');
  console.log('-'.repeat(40));
  
  for (let i = 1; i <= 3; i++) {
    await clearCache();
    await new Promise(resolve => setTimeout(resolve, 1000)); // Brief pause
    
    const result = await makeRequest(
      `${BASE_URL}/api/v1/servers?slug=${slug}&ep=${ep}`,
      `Cold ${i}/3`
    );
    results.cold.push(result);
  }
}

// Helper function to run warm tests
async function runWarmTests(results) {
  console.log('\n🔥 Running WARM tests (3 iterations)...');
  console.log('-'.repeat(40));
  
  for (let i = 1; i <= 3; i++) {
    const result = await makeRequest(
      `${BASE_URL}/api/v1/servers?slug=${slug}&ep=${ep}`,
      `Warm ${i}/3`
    );
    results.warm.push(result);
  }
}

// Helper function to calculate statistics
function calculateStatistics(results) {
  const coldTimes = results.cold.filter(r => r.success).map(r => r.duration);
  const warmTimes = results.warm.filter(r => r.success).map(r => r.duration);
  
  const coldMean = coldTimes.length > 0 ? coldTimes.reduce((a, b) => a + b, 0) / coldTimes.length : 0;
  const warmMean = warmTimes.length > 0 ? warmTimes.reduce((a, b) => a + b, 0) / warmTimes.length : 0;
  
  const coldP95 = coldTimes.length > 0 ? coldTimes.sort((a, b) => a - b)[Math.floor(coldTimes.length * 0.95)] : 0;
  const warmP95 = warmTimes.length > 0 ? warmTimes.sort((a, b) => a - b)[Math.floor(warmTimes.length * 0.95)] : 0;
  
  return { coldMean, warmMean, coldP95, warmP95 };
}

async function runBenchmark() {
  const results = {
    cold: [],
    warm: []
  };
  
  // Run tests
  await runColdTests(results);
  await runWarmTests(results);
  
  // Calculate statistics
  const { coldMean, warmMean, coldP95, warmP95 } = calculateStatistics(results);
  
  // Display results and assessment
  displayBenchmarkResults(coldMean, warmMean, coldP95, warmP95);
  displayServerHealth(results);
  const overallPass = displayOverallAssessment(coldMean, warmMean);
  
  console.log('\n' + '=' .repeat(60));
  
  return {
    cold: { mean: coldMean, p95: coldP95, pass: coldMean <= 2500 },
    warm: { mean: warmMean, p95: warmP95, pass: warmMean <= 600 },
    overall: overallPass
  };
}

// Helper function to display benchmark results
function displayBenchmarkResults(coldMean, warmMean, coldP95, warmP95) {
  console.log('\n📈 BENCHMARK RESULTS');
  console.log('=' .repeat(60));
  console.log(`🧊 COLD Performance:`);
  console.log(`   Mean: ${coldMean.toFixed(0)}ms`);
  console.log(`   P95:  ${coldP95.toFixed(0)}ms`);
  console.log(`   Target: ≤ 2500ms`);
  console.log(`   Status: ${coldMean <= 2500 ? '✅ PASS' : '❌ FAIL'}`);
  
  console.log(`\n🔥 WARM Performance:`);
  console.log(`   Mean: ${warmMean.toFixed(0)}ms`);
  console.log(`   P95:  ${warmP95.toFixed(0)}ms`);
  console.log(`   Target: ≤ 600ms`);
  console.log(`   Status: ${warmMean <= 600 ? '✅ PASS' : '❌ FAIL'}`);
}

// Helper function to display server health
function displayServerHealth(results) {
  const lastResult = results.warm.find(r => r.success);
  if (lastResult) {
    // Determine health status based on server counts
    let healthStatus;
    if (lastResult.degradedCount === 0) {
      healthStatus = '✅ PERFECT';
    } else if (lastResult.activeCount > 0) {
      healthStatus = '⚠️ PARTIAL';
    } else {
      healthStatus = '❌ CRITICAL';
    }
    
    console.log(`\n🏥 SERVER HEALTH:`);
    console.log(`   Total servers: ${lastResult.serverCount}`);
    console.log(`   Active: ${lastResult.activeCount}`);
    console.log(`   Degraded: ${lastResult.degradedCount}`);
    console.log(`   Health: ${healthStatus}`);
  }
}

// Helper function to display overall assessment
function displayOverallAssessment(coldMean, warmMean) {
  const coldPass = coldMean <= 2500;
  const warmPass = warmMean <= 600;
  const overallPass = coldPass && warmPass;
  
  console.log(`\n🎯 OVERALL ASSESSMENT: ${overallPass ? '✅ PASS' : '❌ FAIL'}`);
  
  if (!overallPass) {
    console.log('\n🔧 RECOMMENDATIONS:');
    if (!coldPass) {
      console.log('   • Increase SCRAPE_CONCURRENCY (current: ' + (process.env.SCRAPE_CONCURRENCY || '5') + ')');
      console.log('   • Reduce SCRAPE_TIMEOUT_MS (current: ' + (process.env.SCRAPE_TIMEOUT_MS || '8000') + ')');
      console.log('   • Check network latency to latanime.org');
    }
    if (!warmPass) {
      console.log('   • Verify Redis connection for cache performance');
      console.log('   • Check cache TTL settings');
    }
  }
  
  return overallPass;
}

// Auto-tuning function
async function autoTune() {
  console.log('\n🎛️ AUTO-TUNING PERFORMANCE...');
  
  let concurrency = parseInt(process.env.SCRAPE_CONCURRENCY) || 5;
  let timeout = parseInt(process.env.SCRAPE_TIMEOUT_MS) || 8000;
  let attempts = 0;
  const maxAttempts = 3;
  
  while (attempts < maxAttempts) {
    console.log(`\n🔄 Attempt ${attempts + 1}/${maxAttempts} (concurrency: ${concurrency}, timeout: ${timeout}ms)`);
    
    // Set environment variables for this attempt
    process.env.SCRAPE_CONCURRENCY = concurrency.toString();
    process.env.SCRAPE_TIMEOUT_MS = timeout.toString();
    
    const results = await runBenchmark();
    
    if (results.overall) {
      console.log('\n🎉 Performance targets achieved!');
      break;
    }
    
    attempts++;
    
    if (attempts < maxAttempts) {
      // Adjust parameters
      if (!results.cold.pass) {
        concurrency = Math.min(concurrency + 2, 10);
        timeout = Math.max(timeout - 1000, 5000);
      }
      if (!results.warm.pass) {
        // Warm performance issues are usually cache-related
        console.log('⚠️ Warm performance issues detected - check Redis connection');
      }
      
      console.log(`🔧 Adjusting: concurrency → ${concurrency}, timeout → ${timeout}ms`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  if (attempts >= maxAttempts) {
    console.log('\n⚠️ Could not achieve performance targets after auto-tuning');
    console.log('Manual optimization may be required');
  }
}

// Main execution
async function main() {
  try {
    // Check if server is running
    try {
      await axios.get(`${BASE_URL}/health`);
    } catch (serverError) {
      console.error('❌ Server is not running at', BASE_URL);
      console.error('Error details:', serverError.message);
      console.log('💡 Start the server with: npm run dev');
      process.exit(1);
    }
    
    const shouldAutoTune = process.argv.includes('--auto-tune');
    
    if (shouldAutoTune) {
      await autoTune();
    } else {
      await runBenchmark();
    }
    
  } catch (error) {
    console.error('💥 Benchmark failed:', error.message);
    process.exit(1);
  }
}

// Handle CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
