import { http, HttpResponse } from "msw";

export const handlers = [
  http.get("*/v1/tracking/search", () => {
    return HttpResponse.json({
      success: true,
      data: [
        {
          _id: "bus_1",
          busName: "Test Express",
          busNumber: "WB-01-1234",
          operator: "Test Operator",
          route: {
            routeCode: "R-101",
            origin: "Kolkata",
            destination: "Durgapur",
            stops: [],
          },
        },
      ],
    });
  }),

  http.get("*/v1/tracking/bus/:busNumber/latest", () => {
    return HttpResponse.json({
      success: true,
      data: {
        liveLocation: {
          busNumber: "WB-01-1234",
          lat: 22.5726,
          lng: 88.3639,
          recordedAt: new Date().toISOString(),
        },
      },
    });
  }),
];

