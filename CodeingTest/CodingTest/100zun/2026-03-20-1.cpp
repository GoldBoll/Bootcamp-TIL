#include <iostream>
using namespace std;

int main()
{
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n;
    cin >> n;

    int val, minVal, maxVal;
    cin >> val;
    minVal = maxVal = val;

    for (int i = 1; i < n; i++) {
        cin >> val;
        if (val < minVal) minVal = val;
        if (val > maxVal) maxVal = val;
    }

    cout << minVal << " " << maxVal << "\n";
    return 0;
}
