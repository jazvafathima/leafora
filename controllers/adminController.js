const Admin = require("../models/admin");
const bcrypt = require("bcrypt");
const User = require("../models/User");
const Order = require("../models/Order");
const PDFDocument = require("pdfkit");

exports.loadLogin = (req, res) => {
  res.render("admin/login");
};

exports.getDashboard = async (req, res) => {
  try {
    const topProducts = await Order.aggregate([
      {
        $match: {
          orderStatus: {
            $nin: ["cancelled", "returned"],
          },
        },
      },

      {
        $unwind: "$items",
      },

      {
        $match: {
          "items.itemStatus": {
            $nin: ["cancelled", "returned"],
          },
        },
      },

      {
        $group: {
          _id: "$items.product",

          totalSold: {
            $sum: "$items.quantity",
          },
        },
      },

      {
        $sort: {
          totalSold: -1,
        },
      },

      {
        $limit: 10,
      },

      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },

      {
        $unwind: "$product",
      },
    ]);

    const topCategories = await Order.aggregate([
      {
        $match: {
          orderStatus: {
            $nin: ["cancelled", "returned"],
          },
        },
      },

      {
        $unwind: "$items",
      },

      {
        $match: {
          "items.itemStatus": {
            $nin: ["cancelled", "returned"],
          },
        },
      },

      {
        $lookup: {
          from: "products",
          localField: "items.product",
          foreignField: "_id",
          as: "product",
        },
      },

      {
        $unwind: "$product",
      },

      {
        $group: {
          _id: "$product.category",

          totalSold: {
            $sum: "$items.quantity",
          },
        },
      },

      {
        $sort: {
          totalSold: -1,
        },
      },

      {
        $limit: 10,
      },

      {
        $lookup: {
          from: "categories",
          localField: "_id",
          foreignField: "_id",
          as: "category",
        },
      },

      {
        $unwind: "$category",
      },
    ]);

    const recentOrders = await Order.find()
      .populate("user", "firstName lastName")
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const formattedRecentOrders = recentOrders.map((order) => ({
      orderId: order.orderId,
      customer:
        `${order.user?.firstName || ""} ${order.user?.lastName || ""}`.trim() ||
        "Guest",
      date: order.createdAt,
      status: order.orderStatus,
      amount: order.finalAmount || order.total || 0,
    }));
    console.log(formattedRecentOrders);

    const totalOrders = await Order.countDocuments();

    const totalUsers = await User.countDocuments({
      isBlocked: false,
    });

    const pendingOrders = await Order.countDocuments({
      orderStatus: "pending",
    });

    const revenueResult = await Order.aggregate([
      {
        $match: {
          orderStatus: "delivered",
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: {
            $sum: "$total",
          },
        },
      },
    ]);

    const totalRevenue =
      revenueResult.length > 0 ? revenueResult[0].totalRevenue : 0;

    const stats = {
      totalOrders,

      totalRevenue,

      totalUsers,

      pendingOrders,
    };

    res.render("admin/dashboard", {
      totalRevenue: 0,
      totalOrders: 0,
      totalUsers: 0,
      totalProducts: 0,

      chartLabels: ["2022", "2023", "2024", "2025", "2026"],
      chartValues: [0, 0, 0, 0, 9305],

      topProducts,
      topCategories,
      recentOrders: formattedRecentOrders,

      stats,

      recentOrders,

      topProducts,

      topCategories,

     
       
    });
  } catch (err) {
    console.log(err);
    res.redirect("/admin/login");
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (email !== adminEmail || password !== adminPassword) {
      return res.render("admin/login", {
        error: "Invalid email or password",
      });
    }

    req.session.adminId = adminEmail;
    delete req.session.userId;

    return res.redirect("/admin/dashboard");
  } catch (err) {
    console.log(err);
    return res.render("admin/login", {
      error: "Something went wrong",
    });
  }
};

// ✅ BLOCK USER
exports.blockUser = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, {
      isBlocked: true,
    });

    res.redirect("/admin/users");
  } catch (err) {
    console.log(err);
    res.send("Error blocking user");
  }
};

// ✅ UNBLOCK USER
exports.unblockUser = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, {
      isBlocked: false,
    });

    res.redirect("/admin/users");
  } catch (err) {
    console.log(err);
    res.send("Error unblocking user");
  }
};

exports.getUsers = async (req, res) => {
  try {
    const search = req.query.search || "";
    console.log("SEARCH:", search);

    const role = req.query.role || "";
    const status = req.query.status || "";

    const page = parseInt(req.query.page) || 1;
    const limit = 3;
    const skip = (page - 1) * limit;

    let query = {};

    // 🔍 SEARCH
    if (search.trim() !== "") {
      query.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    // 🎭 ROLE
    if (role) {
      query.role = role;
    }

    // 🚦 STATUS (FIXED)
    if (status === "active") {
      query.isBlocked = false;
    }

    if (status === "blocked") {
      query.isBlocked = true;
    }

    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(query);

    const totalPages = Math.ceil(total / limit);

    res.render("admin/users", {
      users,
      search,
      role,
      status,
      currentPage: page,
      totalPages, // ✅ correct
      totalUsers: total,
    });
  } catch (err) {
    console.log(err);
    res.status(500).send("Server Error");
  }
};

exports.logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.log(err);
      return res.redirect("/admin/dashboard");
    }

    res.clearCookie("connect.sid");

    res.redirect("/admin/login");
  });
};

exports.getChartData = async (req, res) => {
  try {
    const filter = req.query.filter || "yearly";

    let groupId = {};
    let startDate = new Date();

    const now = new Date();

    switch (filter) {
      case "daily":
        startDate.setDate(now.getDate() - 6);

        groupId = {
          day: { $dayOfMonth: "$createdAt" },
          month: { $month: "$createdAt" },
        };
        break;

      case "weekly":
        startDate.setDate(now.getDate() - 34);

        groupId = {
          week: { $isoWeek: "$createdAt" },
          year: { $isoWeekYear: "$createdAt" },
        };
        break;

      case "monthly":
        startDate = new Date(now.getFullYear(), 0, 1);

        groupId = {
          month: { $month: "$createdAt" },
        };
        break;

      default:
        // yearly
        startDate = new Date(now.getFullYear() - 4, 0, 1);

        groupId = {
          year: { $year: "$createdAt" },
        };
    }

    const result = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          paymentStatus: "paid",
        },
      },
      {
        $group: {
          _id: groupId,
          totalSales: { $sum: "$total" },
        },
      },
    ]);

    let labels = [];
    let values = [];

    // ================= YEARLY =================
    if (filter === "yearly") {
      const salesMap = {};

      result.forEach((item) => {
        salesMap[item._id.year] = item.totalSales;
      });

      for (
        let year = now.getFullYear() - 4;
        year <= now.getFullYear();
        year++
      ) {
        labels.push(String(year));
        values.push(salesMap[year] || 0);
      }
    }

    // ================= MONTHLY =================
    else if (filter === "monthly") {
      const monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];

      const salesMap = {};

      result.forEach((item) => {
        salesMap[item._id.month] = item.totalSales;
      });

      for (let month = 1; month <= 12; month++) {
        labels.push(monthNames[month - 1]);
        values.push(salesMap[month] || 0);
      }
    }

    // ================= WEEKLY =================
    else if (filter === "weekly") {
      const salesMap = {};

      result.forEach((item) => {
        salesMap[item._id.week] = item.totalSales;
      });

      const currentWeek = getISOWeek(now);

      for (let week = currentWeek - 4; week <= currentWeek; week++) {
        labels.push(`Week ${week}`);
        values.push(salesMap[week] || 0);
      }
    }

    // ================= DAILY =================
    else if (filter === "daily") {
      const salesMap = {};

      result.forEach((item) => {
        const key = `${item._id.day}-${item._id.month}`;
        salesMap[key] = item.totalSales;
      });

      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(now.getDate() - i);

        const day = date.getDate();
        const month = date.getMonth() + 1;

        labels.push(`${day}/${month}`);

        const key = `${day}-${month}`;
        values.push(salesMap[key] || 0);
      }
    }

    res.json({
      labels,
      values,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
};

// Helper Function
function getISOWeek(date) {
  const tempDate = new Date(date.getTime());

  tempDate.setHours(0, 0, 0, 0);

  tempDate.setDate(tempDate.getDate() + 3 - ((tempDate.getDay() + 6) % 7));

  const week1 = new Date(tempDate.getFullYear(), 0, 4);

  return (
    1 +
    Math.round(
      ((tempDate - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7,
    )
  );
}
exports.getReports = async (req, res) => {
  try {
    const filter = req.query.filter || "daily";

    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    switch (filter) {
      case "daily":
        start = new Date();
        start.setHours(0, 0, 0, 0);

        end = new Date();
        end.setHours(23, 59, 59, 999);

        break;

      case "weekly":
        start = new Date();
        start.setDate(start.getDate() - 6);
        start.setHours(0, 0, 0, 0);

        break;

      case "yearly":
        start = new Date(new Date().getFullYear(), 0, 1);

        break;

      default:
        start = new Date();
        start.setHours(0, 0, 0, 0);
    }

    const orders = await Order.find({
      orderStatus: "delivered",

      createdAt: {
        $gte: start,
        $lte: end,
      },
    })
      .populate("user", "firstName lastName")
      .sort({ createdAt: -1 })
      .lean();

    res.render("admin/reports", {
      orders,
      filter,
      startDate,
      endDate,
      orders,
    });
  } catch (err) {
    console.log(err);
  }
};

exports.getReports = async (req, res) => {
  try {
    const filter = req.query.filter || "daily";
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    const query = {
      orderStatus: "delivered",
    };

    // ===== Daily =====
    if (filter === "daily") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      query.createdAt = {
        $gte: today,
        $lt: tomorrow,
      };
    }

    // ===== Weekly =====
    else if (filter === "weekly") {
      const end = new Date();

      const start = new Date();
      start.setDate(end.getDate() - 6);
      start.setHours(0, 0, 0, 0);

      end.setHours(23, 59, 59, 999);

      query.createdAt = {
        $gte: start,
        $lte: end,
      };
    }

    // ===== Yearly =====
    else if (filter === "yearly") {
      const year = new Date().getFullYear();

      query.createdAt = {
        $gte: new Date(year, 0, 1),
        $lte: new Date(year, 11, 31, 23, 59, 59),
      };
    }

    // ===== Custom =====
    else if (filter === "custom") {
      if (startDate && endDate) {
        query.createdAt = {
          $gte: new Date(startDate),
          $lte: new Date(endDate + "T23:59:59"),
        };
      }
    }

    const orders = await Order.find(query)
      .populate("user", "firstName lastName")
      .sort({ createdAt: -1 })
      .lean();

    let totalOrders = orders.length;

    let grossSales = 0;
    let totalDiscount = 0;
    let shipping = 0;
    let tax = 0;
    let netSales = 0;

    let orderLabels = [];
    let orderValues = [];

    for (let i = 6; i >= 0; i--) {
      const day = new Date();
      day.setDate(day.getDate() - i);
      day.setHours(0, 0, 0, 0);

      const nextDay = new Date(day);
      nextDay.setDate(day.getDate() + 1);

      orderLabels.push(
        day.toLocaleDateString("en-IN", {
          weekday: "short",
        }),
      );

      const count = orders.filter(
        (order) => order.createdAt >= day && order.createdAt < nextDay,
      ).length;

      orderValues.push(count);
    }

    const categorySales = await Order.aggregate([
      {
        $match: query,
      },

      {
        $unwind: "$items",
      },

      {
        $lookup: {
          from: "products",
          localField: "items.product",
          foreignField: "_id",
          as: "product",
        },
      },

      {
        $unwind: "$product",
      },

      {
        $lookup: {
          from: "categories",
          localField: "product.category",
          foreignField: "_id",
          as: "category",
        },
      },

      {
        $unwind: "$category",
      },

      {
        $group: {
          _id: "$category.name",

          revenue: {
            $sum: "$items.total",
          },
        },
      },

      {
        $sort: {
          revenue: -1,
        },
      },
    ]);

    const categoryLabels = categorySales.map((c) => c._id);

    const categoryValues = categorySales.map((c) => c.revenue);

    res.render("admin/reports", {
      filter,
      startDate,
      endDate,

      orders,

      totalOrders,
      grossSales,
      totalDiscount,
      shipping,
      tax,
      netSales,

      orderLabels,
      orderValues,

      categoryLabels,
      categoryValues,
    });
  } catch (err) {
    console.log(err);
    res.redirect("/admin/dashboard");
  }
};

exports.exportSalesReportPDF = async (req, res) => {
  try {
    const filter = req.query.filter || "daily";
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    const query = {
      orderStatus: "delivered",
    };

    // Daily
    if (filter === "daily") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      query.createdAt = {
        $gte: today,
        $lt: tomorrow,
      };
    }

    // Weekly
    else if (filter === "weekly") {
      const end = new Date();
      const start = new Date();

      start.setDate(end.getDate() - 6);

      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);

      query.createdAt = {
        $gte: start,
        $lte: end,
      };
    }

    // Yearly
    else if (filter === "yearly") {
      const year = new Date().getFullYear();

      query.createdAt = {
        $gte: new Date(year, 0, 1),
        $lte: new Date(year, 11, 31, 23, 59, 59),
      };
    }

    // Custom
    else if (filter === "custom") {
      if (startDate && endDate) {
        query.createdAt = {
          $gte: new Date(startDate),
          $lte: new Date(endDate + "T23:59:59"),
        };
      }
    }

    const orders = await Order.find(query)
      .populate("user", "firstName lastName")
      .populate({
        path: "items.product",
        populate: {
          path: "category",
        },
      })
      .sort({ createdAt: -1 })
      .lean();

    let totalOrders = orders.length;

    let grossSales = 0;
    let totalDiscount = 0;
    let netRevenue = 0;

    orders.forEach((order) => {
      grossSales += order.subtotal || 0;
      totalDiscount += order.discount || 0;
      netRevenue += order.total || 0;
    });

    const doc = new PDFDocument({
      margin: 40,
      size: "A4",
    });

    res.setHeader("Content-Type", "application/pdf");

    res.setHeader(
      "Content-Disposition",
      "attachment; filename=Leafora_Sales_Report.pdf",
    );

    doc.pipe(res);

    doc.rect(0, 0, 595, 90).fill("#14532d");

    doc.fillColor("white").fontSize(24).text("LEAFORA", 40, 28);

    doc.fontSize(11).text("Administrative Sales Report", 40, 58);

    doc
      .fontSize(10)
      .text(`Generated : ${new Date().toLocaleDateString()}`, 380, 30);

    doc.text(`Filter : ${filter.toUpperCase()}`, 380, 50);

    doc.fillColor("black");

    let top = 120;

    const cards = [
      {
        title: "TOTAL ORDERS",
        value: totalOrders,
      },

      {
        title: "GROSS SALES",
        value: `₹${grossSales.toLocaleString()}`,
      },

      {
        title: "DISCOUNTS",
        value: `₹${totalDiscount.toLocaleString()}`,
      },

      {
        title: "NET REVENUE",
        value: `₹${netRevenue.toLocaleString()}`,
      },
    ];

    let x = 40;

    cards.forEach((card) => {
      doc.roundedRect(x, top, 120, 70, 5).stroke("#d1d5db");

      doc
        .fontSize(10)
        .fillColor("#6b7280")
        .text(card.title, x + 10, top + 10);

      doc
        .fontSize(18)
        .fillColor("#14532d")
        .text(card.value, x + 10, top + 30);

      x += 130;
    });

    let tableTop = 240;

    doc.fillColor("#14532d").rect(40, tableTop, 515, 25).fill();

    doc.fillColor("white").fontSize(10);

    doc.text("Order ID", 50, 248);

    doc.text("Customer", 170, 248);

    doc.text("Date", 320, 248);

    doc.text("Amount", 410, 248);

    doc.text("Status", 500, 248);

    let y = tableTop + 35;

    orders.forEach((order) => {
      doc.fillColor("black").fontSize(9);

      doc.text(order.orderId, 50, y);

      doc.text(
        `${order.user?.firstName || ""} ${order.user?.lastName || ""}`,

        170,

        y,
      );

      doc.text(
        new Date(order.createdAt).toLocaleDateString(),

        320,

        y,
      );

      doc.text(
        `₹${order.total}`,

        410,

        y,
      );

      doc.text(
        order.orderStatus,

        500,

        y,
      );

      y += 25;

      doc
        .moveTo(40, y - 5)
        .lineTo(555, y - 5)
        .stroke("#e5e7eb");

      if (y > 720) {
        doc.addPage();

        y = 60;
      }
    });

    y += 20;

    doc

      .fontSize(12)

      .fillColor("#14532d")

      .text(
        `Total Orders : ${totalOrders}`,

        40,

        y,
      );

    doc.text(
      `Gross Sales : ₹${grossSales.toLocaleString()}`,

      220,

      y,
    );

    doc.text(
      `Net Revenue : ₹${netRevenue.toLocaleString()}`,

      400,

      y,
    );

    doc

      .fontSize(10)

      .fillColor("gray")

      .text(
        "Leafora Sales Report",

        40,

        780,

        {
          align: "center",
        },
      );

    let paymentSummary = {
      cod: 0,
      online: 0,
      wallet: 0,
    };

    orders.forEach((order) => {
      if (order.paymentMethod === "cod") {
        paymentSummary.cod += order.total;
      }

      if (order.paymentMethod === "online") {
        paymentSummary.online += order.total;
      }

      if (order.paymentMethod === "wallet") {
        paymentSummary.wallet += order.total;
      }
    });

    const productMap = {};

    orders.forEach((order) => {
      order.items.forEach((item) => {
        if (!productMap[item.name]) {
          productMap[item.name] = {
            quantity: 0,
            revenue: 0,
          };
        }

        productMap[item.name].quantity += item.quantity;

        productMap[item.name].revenue += item.total;
      });
    });

    const topProducts = Object.entries(productMap)

      .sort((a, b) => b[1].quantity - a[1].quantity)

      .slice(0, 5);

    const categoryMap = {};

    orders.forEach((order) => {
      order.items.forEach((item) => {
        const category = item.product?.category?.name || "Unknown";

        if (!categoryMap[category]) {
          categoryMap[category] = 0;
        }

        categoryMap[category] += item.total;
      });
    });

    const topCategories = Object.entries(categoryMap)

      .sort((a, b) => b[1] - a[1])

      .slice(0, 5);

    let paymentY = 210;

    doc

      .fontSize(16)

      .fillColor("#14532d")

      .text("Payment Summary", 40, paymentY);

    paymentY += 25;

    doc

      .fontSize(11)

      .fillColor("black");

    // .text(`COD : ₹${paymentSummary.cod.toLocaleString()}`, 50, paymentY);

    paymentY += 20;

    doc.text(
      // `Online : ₹${paymentSummary.online.toLocaleString()}`,

      50,

      paymentY,
    );

    // paymentY += 20;

    doc.text(
      // `Wallet : ₹${paymentSummary.wallet.toLocaleString()}`,

      50,

      paymentY,
    );

    y += 40;

    doc

      .fontSize(16)

      .fillColor("#14532d")

      .text("Top Selling Products", 40, y);

    y += 25;

    doc

      .fontSize(11)

      .fillColor("black");

    topProducts.forEach((product, index) => {
      doc.text(
        `${index + 1}. ${product[0]}`,

        50,

        y,
      );

      doc.text(
        `${product[1].quantity} sold`,

        320,

        y,
      );

      doc.text(
        `₹${product[1].revenue.toLocaleString()}`,

        450,

        y,
      );

      y += 20;
    });

    y += 30;

    doc

      .fontSize(16)

      .fillColor("#14532d")

      .text("Top Categories", 40, y);

    y += 25;

    doc

      .fontSize(11)

      .fillColor("black");

    topCategories.forEach((category, index) => {
      doc.text(
        `${index + 1}. ${category[0]}`,

        50,

        y,
      );

      doc.text(
        `₹${category[1].toLocaleString()}`,

        450,

        y,
      );

      y += 20;

      if (index % 2 === 0) {
        doc

          .rect(40, y - 4, 515, 22)

          .fill("#f8fafc");
      }

      doc.fillColor("black");

      doc

        .moveTo(40, 770)

        .lineTo(555, 770)

        .stroke("#d1d5db");

      doc

        .fontSize(9)

        .fillColor("gray")

        .text(
          "Generated by Leafora Admin Panel",

          40,

          780,

          {
            align: "center",
          },
        );
    });
    doc.end();
  } catch (err) {
    console.log(err);

    res.redirect("/admin/reports");
  }
};

exports.exportSalesReportExcel = async (req, res) => {};
