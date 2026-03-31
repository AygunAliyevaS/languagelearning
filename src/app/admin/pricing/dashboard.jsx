import { useState, useEffect } from 'react';
import { useFetcher } from 'react-router';

export default function PricingDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [plans, setPlans] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [analytics, setAnalytics] = useState({});
  const [loading, setLoading] = useState(true);
  const fetcher = useFetcher();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [plansRes, subsRes, purchasesRes, analyticsRes] = await Promise.all([
        fetch('/api/pricing?action=plans'),
        fetch('/api/subscriptions?action=status'),
        fetch('/api/purchases?action=available'),
        fetch('/api/analytics?action=overview'),
      ]);

      const [plansData, subsData, purchasesData, analyticsData] = await Promise.all([
        plansRes.json(),
        subsRes.json(),
        purchasesRes.json(),
        analyticsRes.json(),
      ]);

      setPlans(plansData.plans || []);
      setSubscriptions(subsData || []);
      setPurchases(purchasesData || {});
      setAnalytics(analyticsData || {});
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlanUpdate = (planId, updates) => {
    fetcher.submit(
      { action: 'update-plan', planId, ...updates },
      { method: 'POST', action: '/api/admin/pricing' }
    );
  };

  const renderOverview = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <MetricCard
        title="Total Revenue"
        value={`$${analytics.totalRevenue || 0}`}
        change={analytics.revenueGrowth || 0}
        icon="💰"
      />
      <MetricCard
        title="Active Subscriptions"
        value={analytics.activeSubscriptions || 0}
        change={analytics.subscriptionGrowth || 0}
        icon="👥"
      />
      <MetricCard
        title="Conversion Rate"
        value={`${(analytics.conversionRate || 0).toFixed(1)}%`}
        change={analytics.conversionGrowth || 0}
        icon="📈"
      />
      <MetricCard
        title="Avg. Revenue/User"
        value={`$${(analytics.avgRevenuePerUser || 0).toFixed(2)}`}
        change={analytics.arpuGrowth || 0}
        icon="📊"
      />
    </div>
  );

  const renderPlans = () => (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Subscription Plans</h2>
        <button
          onClick={() => fetcher.submit(
            { action: 'create-plan' },
            { method: 'POST', action: '/api/admin/pricing' }
          )}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Add New Plan
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            onUpdate={handlePlanUpdate}
            onDelete={(planId) => fetcher.submit(
              { action: 'delete-plan', planId },
              { method: 'POST', action: '/api/admin/pricing' }
            )}
          />
        ))}
      </div>
    </div>
  );

  const renderSubscriptions = () => (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-6">Subscription Management</h2>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Plan
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Next Billing
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {subscriptions.map((sub) => (
              <tr key={sub.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {sub.userId}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {sub.planName}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    sub.status === 'active' 
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {sub.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {sub.nextBilling ? new Date(sub.nextBilling).toLocaleDateString() : 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => fetcher.submit(
                      { action: 'cancel-subscription', subscriptionId: sub.id },
                      { method: 'POST', action: '/api/admin/subscriptions' }
                    )}
                    className="text-red-600 hover:text-red-900 mr-3"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => fetcher.submit(
                      { action: 'refund-subscription', subscriptionId: sub.id },
                      { method: 'POST', action: '/api/admin/subscriptions' }
                    )}
                    className="text-orange-600 hover:text-orange-900"
                  >
                    Refund
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderPurchases = () => (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-6">One-Time Purchases</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.entries(purchases).map(([category, data]) => (
          <div key={category} className="border rounded-lg p-4">
            <h3 className="font-semibold mb-2">{data.name}</h3>
            <p className="text-sm text-gray-600 mb-4">{data.description}</p>
            
            <div className="space-y-2">
              {Object.entries(data.items || {}).map(([itemId, item]) => (
                <div key={itemId} className="flex justify-between items-center text-sm">
                  <span>{item.name}</span>
                  <span className="font-medium">${item.price}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderAnalytics = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-6">Revenue Analytics</h2>
        <RevenueChart data={analytics.revenueData || []} />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Plan Distribution</h3>
          <PlanDistributionChart data={analytics.planDistribution || []} />
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Conversion Funnel</h3>
          <ConversionFunnel data={analytics.conversionFunnel || []} />
        </div>
      </div>
    </div>
  );

  const renderInstitutional = () => (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Institutional Partnerships</h2>
        <button
          onClick={() => fetcher.submit(
            { action: 'create-institution' },
            { method: 'POST', action: '/api/admin/institutional' }
          )}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Add Institution
        </button>
      </div>

      <InstitutionalTable institutions={analytics.institutions || []} />
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Pricing Dashboard</h1>
        <p className="text-gray-600 mt-2">Manage subscription plans, purchases, and analytics</p>
      </div>

      <div className="border-b border-gray-200 mb-8">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'plans', label: 'Plans' },
            { id: 'subscriptions', label: 'Subscriptions' },
            { id: 'purchases', label: 'Purchases' },
            { id: 'analytics', label: 'Analytics' },
            { id: 'institutional', label: 'Institutional' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'plans' && renderPlans()}
      {activeTab === 'subscriptions' && renderSubscriptions()}
      {activeTab === 'purchases' && renderPurchases()}
      {activeTab === 'analytics' && renderAnalytics()}
      {activeTab === 'institutional' && renderInstitutional()}
    </div>
  );
}

// Metric Card Component
function MetricCard({ title, value, change, icon }) {
  const isPositive = change >= 0;
  
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <span className="text-2xl">{icon}</span>
        </div>
        <div className="ml-4 w-0 flex-1">
          <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
          <dd className="flex items-baseline">
            <div className="text-2xl font-semibold text-gray-900">{value}</div>
            <div
              className={`ml-2 flex items-baseline text-sm font-semibold ${
                isPositive ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {isPositive ? '↑' : '↓'} {Math.abs(change)}%
            </div>
          </dd>
        </div>
      </div>
    </div>
  );
}

// Plan Card Component
function PlanCard({ plan, onUpdate, onDelete }) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(plan);

  const handleSave = () => {
    onUpdate(plan.id, formData);
    setIsEditing(false);
  };

  return (
    <div className="border rounded-lg p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          {isEditing ? (
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="text-lg font-semibold border rounded px-2 py-1"
            />
          ) : (
            <h3 className="text-lg font-semibold">{plan.name}</h3>
          )}
          <p className="text-sm text-gray-600">{plan.id}</p>
        </div>
        
        <div className="flex space-x-2">
          {isEditing ? (
            <>
              <button
                onClick={handleSave}
                className="text-green-600 hover:text-green-800"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setFormData(plan);
                }}
                className="text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="text-blue-600 hover:text-blue-800"
              >
                Edit
              </button>
              <button
                onClick={() => onDelete(plan.id)}
                className="text-red-600 hover:text-red-800"
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {isEditing ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Price</label>
            <input
              type="number"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
              className="w-full border rounded px-2 py-1"
              step="0.01"
            />
          </div>
        ) : (
          <div className="text-2xl font-bold text-blue-600">
            ${plan.price}
            {plan.annualPrice && (
              <span className="text-sm text-gray-500 font-normal">
                /year or ${plan.annualPrice}
              </span>
            )}
          </div>
        )}

        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Features:</h4>
          {Object.entries(plan.features).map(([feature, enabled]) => (
            <div key={feature} className="flex items-center text-sm">
              <span className={`w-2 h-2 rounded-full mr-2 ${
                enabled ? 'bg-green-500' : 'bg-gray-300'
              }`} />
              {feature}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Chart Components (simplified - would use actual charting library)
function RevenueChart({ data }) {
  return (
    <div className="h-64 flex items-center justify-center bg-gray-50 rounded">
      <p className="text-gray-500">Revenue Chart (Chart.js integration needed)</p>
    </div>
  );
}

function PlanDistributionChart({ data }) {
  return (
    <div className="h-64 flex items-center justify-center bg-gray-50 rounded">
      <p className="text-gray-500">Plan Distribution Chart</p>
    </div>
  );
}

function ConversionFunnel({ data }) {
  return (
    <div className="h-64 flex items-center justify-center bg-gray-50 rounded">
      <p className="text-gray-500">Conversion Funnel Chart</p>
    </div>
  );
}

function InstitutionalTable({ institutions }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Institution
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Type
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Users
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {institutions.map((inst) => (
            <tr key={inst.id}>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                {inst.name}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {inst.type}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {inst.userCount}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                  inst.status === 'active' 
                    ? 'bg-green-100 text-green-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {inst.status}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <button className="text-blue-600 hover:text-blue-900 mr-3">
                  Manage
                </button>
                <button className="text-red-600 hover:text-red-900">
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
