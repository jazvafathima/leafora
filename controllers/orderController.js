const Order = require("../models/Order");
const Product = require("../models/Product");
const ProductVariant = require("../models/productvariant");
const puppeteer = require("puppeteer");
const path = require("path");
const { query } = require("express-validator");
const walletService = require("../services/walletService");

const updateProductStock = async (productId) => {
  const variants = await ProductVariant.find({ productId });
  const stock = variants.reduce((sum, v) => sum + (v.stockQuantity || 0), 0);
  await Product.findByIdAndUpdate(productId, { stock });
};

const VALID_STATUSES = [
  "pending",
  "processing",
  "shipped",
  "outForDelivery",
  "delivered",
  "cancelled",
];
const LIMIT = 10;

exports.getOrders = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const search = (req.query.search || "").trim();
    const selectedStatus = req.query.status || "";
    const sort = req.query.sort || "desc";

    // ── Build query ──
    const query = {};

    // Status filter
    if (selectedStatus && VALID_STATUSES.includes(selectedStatus)) {
      query.orderStatus = selectedStatus;
    }

    // Search: order ID or customer name/email
    if (search) {
      query.$or = [
        { orderId: { $regex: search, $options: "i" } },
        { "address.fullName": { $regex: search, $options: "i" } },
      ];
    }

    // i. Sort by date descending (newest first by default)
    const sortObj = { createdAt: sort === "asc" ? 1 : -1 };

    const totalOrders = await Order.countDocuments(query);
    const totalPages = Math.ceil(totalOrders / LIMIT);
    const skip = (page - 1) * LIMIT;

    const orders = await Order.find(query)
      .populate("user", "firstName lastName email phone")
      .sort(sortObj)
      .skip(skip)
      .limit(LIMIT)
      .lean();

    console.log(orders);

    const result = await Order.find({
      orderStatus: "delivered",
      paymentMethod: "cod",
      total: {
        $gt: 200,
        $lt: 1000,
      },
    });
    console.log(result);

    res.render("admin/order/orders", {
      orders,
      totalOrders,
      totalPages,
      currentPage: page,
      search,
      selectedStatus,
      sort,
      success: req.flash ? req.flash("success") : [],
      error: req.flash ? req.flash("error") : [],
    });
  } catch (err) {
    console.error("orderController.getOrders:", err);
    res.status(500).render("error", { message: "Could not load orders." });
  }
};

exports.getadminOrderDetail = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("user", "firstName lastName email phone")
      .populate("items.product", "name images")
      .lean();

    const originalSubtotal = order.items.reduce(
      (sum, item) => sum + (item.originalPrice || item.price) * item.quantity,
      0,
    );

    const offerDiscount = order.items.reduce(
      (sum, item) =>
        sum + ((item.originalPrice || item.price) - item.price) * item.quantity,
      0,
    );

    const couponDiscount = order.discount || 0;

    const subtotal = originalSubtotal - offerDiscount;

    const shipping = order.shipping || 0;

    const total = subtotal - couponDiscount + shipping;

    res.render("admin/order/orderDetail", {
      order,
      originalSubtotal,
      offerDiscount,
      couponDiscount,
      subtotal,
      shipping,
      total,
      success: req.flash("success"),
      error: req.flash("error"),
    });
  } catch (err) {
    console.error("orderController.getOrderDetail:", err);
    res
      .status(500)
      .render("error", { message: "Could not load order details." });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { orderStatus } = req.body;
    const { id } = req.params;

    if (!VALID_STATUSES.includes(orderStatus)) {
      req.flash && req.flash("error", "Invalid status value.");
      return res.redirect(`/admin/orders/${id}`);
    }

    const order = await Order.findById(id);
    if (!order) {
      req.flash && req.flash("error", "Order not found.");
      return res.redirect("/admin/orders");
    }

    // Prevent reverting from cancelled/delivered
    if (
      ["cancelled", "delivered"].includes(order.orderStatus) &&
      order.orderStatus !== orderStatus
    ) {
      req.flash &&
        req.flash("error", `Cannot change status from "${order.orderStatus}".`);
      return res.redirect(`/admin/orders/${id}`);
    }

    // If cancelling, restore stock
    if (orderStatus === "cancelled" && order.orderStatus !== "cancelled") {
      console.log("ENTERED STOCK RESTORE BLOCK");
      for (const item of order.items) {
        if (item.variantId) {
          console.log("Restoring variant stock");

          await ProductVariant.updateOne(
            { _id: item.variantId },
            {
              $inc: {
                stockQuantity: item.quantity,
              },
            },
          );

          await updateProductStock(item.product);
        } else {
          await Product.updateOne(
            { _id: item.product },
            {
              $inc: {
                stock: item.quantity,
              },
            },
          );
        }
      }
    }

    // Update all item statuses to match order status
    order.orderStatus = orderStatus;
    order.items.forEach((item) => {
      item.itemStatus = orderStatus;
    });

    // If delivered, mark payment as paid (for COD)
    if (orderStatus === "delivered" && order.paymentMethod === "cod") {
      order.paymentStatus = "paid";
    }

    await order.save();

    req.flash &&
      req.flash("success", `Order status updated to "${orderStatus}".`);
    res.redirect(`/admin/orders/${id}`);
  } catch (err) {
    console.error("orderController.updateOrderStatus:", err);
    req.flash && req.flash("error", "Failed to update status.");
    res.redirect(`/admin/orders/${req.params.id}`);
  }
};

exports.updateItemStatus = async (req, res) => {
  try {
    const { id, itemIdx } = req.params;
    const { itemStatus } = req.body;
    const idx = parseInt(itemIdx);

    if (!VALID_STATUSES.includes(itemStatus)) {
      req.flash && req.flash("error", "Invalid status.");
      return res.redirect(`/admin/orders/${id}`);
    }

    const order = await Order.findById(id);
    if (!order || !order.items[idx]) {
      req.flash && req.flash("error", "Order or item not found.");
      return res.redirect(`/admin/orders/${id}`);
    }

    const item = order.items[idx];

    if (item.itemStatus === "cancelled") {
      req.flash("error", "Cancelled items cannot be updated.");
      return res.redirect(`/admin/orders/${id}`);
    }
    const currentStatus = order.items[idx].itemStatus;

    const validTransitions = {
      pending: ["processing", "cancelled"],
      processing: ["shipped", "cancelled"],
      shipped: ["outForDelivery", "cancelled"],
      outForDelivery: ["delivered"],
      delivered: [],
      cancelled: [],
    };

    if (
      currentStatus !== itemStatus &&
      !validTransitions[currentStatus]?.includes(itemStatus)
    ) {
      req.flash("error", "Invalid status transition.");
      return res.redirect(`/admin/orders/${id}`);
    }

    item.itemStatus = itemStatus;

    // Sync overall order status: if all items share same status → update order
    const allStatuses = order.items.map(
      (i) => i.itemStatus || order.orderStatus,
    );
    const uniqueStatuses = [...new Set(allStatuses)];
    if (uniqueStatuses.length === 1) {
      order.orderStatus = uniqueStatuses[0];
    }

    await order.save();

    req.flash && req.flash("success", "Item status updated.");
    res.redirect(`/admin/orders/${id}`);
  } catch (err) {
    console.error("orderController.updateItemStatus:", err);
    req.flash && req.flash("error", "Failed to update item status.");
    res.redirect(`/admin/orders/${req.params.id}`);
  }
};

exports.getReturnRequests = async (req, res) => {
  try {
    const orders = await Order.find({
      $or: [
        { orderStatus: "returnRequested" },
        { "items.returnStatus": "requested" },
      ],
    })
      .populate("user")
      .populate("items.product")
      .sort({ createdAt: -1 });

    orders.forEach((order) => {
      console.log("ORDER:", order.orderId);

      order.items.forEach((item) => {
        console.log({
          name: item.name,
          returnStatus: item.returnStatus,
          itemStatus: item.itemStatus,
        });
      });
    });

    res.render("admin/order/returns", {
      orders,
    });
  } catch (err) {
    console.log(err);
    res.redirect("/admin/orders");
  }
};

// Approve a single item return request
exports.approveReturn = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;

    const order = await Order.findById(orderId);

    if (!order) {
      req.flash("error", "Order not found.");
      return res.redirect("/admin/returns");
    }

    const item = order.items.id(itemId);

    if (!item) {
      req.flash("error", "Item not found.");
      return res.redirect("/admin/returns");
    }

    // Prevent approving twice
    if (item.returnStatus === "approved") {
      req.flash("error", "Return already approved.");
      return res.redirect("/admin/returns");
    }

    const refundAmount = item.finalPrice;

    // Update item status
    item.returnStatus = "approved";
    item.itemStatus = "returned";

    // Refund only for prepaid orders
    if (order.paymentMethod === "online" || order.paymentMethod === "wallet")
      console.log("Refund User:", order.user);
    console.log("Refund Amount:", refundAmount);

    {
      await walletService.creditWallet(
        order.user,
        refundAmount,
        `Refund for returned item (${order.orderId})`,
        order._id,
      );

      order.paymentStatus = "refunded";
    }

    // Restore stock
    if (item.variantId) {
      await ProductVariant.updateOne(
        { _id: item.variantId },
        {
          $inc: {
            stockQuantity: item.quantity,
          },
        },
      );

      await updateProductStock(item.product);
    } else {
      await Product.updateOne(
        { _id: item.product },
        {
          $inc: {
            stock: item.quantity,
          },
        },
      );
    }

    // Check whether every returned item has been processed
    const pendingReturns = order.items.some(
      (i) => i.returnStatus === "requested",
    );

    if (!pendingReturns) {
      order.orderStatus = "returned";
    }

    await order.save();

    req.flash("success", `₹${refundAmount} refunded to customer's wallet.`);

    res.redirect("/admin/returns");
  } catch (err) {
    console.error(err);
    req.flash("error", "Unable to approve return.");
    res.redirect("/admin/returns");
  }
};

exports.rejectReturn = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;

    const order = await Order.findById(orderId);
    const item = order.items.id(itemId);

    if (!item) {
      return res.redirect("/admin/returns");
    }

    item.returnStatus = "rejected";

    // IMPORTANT
    item.itemStatus = "delivered";

    await order.save();

    req.flash("success", "Return rejected");
    res.redirect("/admin/returns");
  } catch (err) {
    console.log(err);
    res.redirect("/admin/returns");
  }
};
//  ===================================

function getUserId(req) {
  return req.session.userId || req.session.user?._id;
}

exports.getOrderHistory = async (req, res) => {
  try {
    const userId = getUserId(req);

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const LIMIT = 5;

    const search = (req.query.search || "").trim();
    const selectedStatus = req.query.status || "";

    const query = { user: userId };

    if (search) {
      query.orderId = { $regex: search, $options: "i" };
    }

    if (selectedStatus) {
      query.orderStatus = selectedStatus;
    }

    const totalOrders = await Order.countDocuments(query);

    const totalPages = Math.max(1, Math.ceil(totalOrders / LIMIT));

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * LIMIT)
      .limit(LIMIT)
      .lean();

    res.render("user/orders/orderHistory", {
      orders,
      search,
      selectedStatus,
      currentPage: page,
      totalPages,
      totalOrders,
    });
  } catch (err) {
    console.error("orderController.getOrderHistory:", err);
    res.redirect("/profile");
  }
};

exports.getOrderDetail = async (req, res) => {
  try {
    const userId = getUserId(req);

    const order = await Order.findOne({
      _id: req.params.id,
      user: userId,
    })
      .populate("items.product")
      .lean();

    if (!order) {
      return res.redirect("/orders");
    }
    const activeItems = order.items.filter(
      (item) => !["cancelled", "returned"].includes(item.itemStatus),
    );

    const originalSubtotal = activeItems.reduce((sum, item) => {
      return sum + (item.originalPrice || item.price) * item.quantity;
    }, 0);

    const subtotal = activeItems.reduce((sum, item) => {
      return sum + item.price * item.quantity;
    }, 0);

    const offerDiscount = originalSubtotal - subtotal;

    const couponDiscount = Number(order.discount || 0);

    const shipping = Number(order.shipping || 0);

    const total =
      activeItems.length > 0 ? subtotal - couponDiscount + shipping : 0;

    const activeItemCount = activeItems.length;

    order.items.forEach((item) => {
      console.log(item.name, item.itemStatus, item.returnStatus);
    });
    console.log({
      originalSubtotal,
      offerDiscount,
      couponDiscount,
      subtotal,
      shipping,
      total,
      orderDiscount: order.discount,
    });

    res.render("user/orders/orderDetail", {
      order,
      originalSubtotal,
      subtotal,
      offerDiscount,
      couponDiscount,
      shipping,
      total,
      activeItemCount,
    });
  } catch (err) {
    console.error(err);
    res.redirect("/orders");
  }
};

exports.cancelOrder = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { reason } = req.body;

    const order = await Order.findOne({
      _id: req.params.id,
      user: userId,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (["delivered", "cancelled"].includes(order.orderStatus)) {
      return res.status(400).json({
        success: false,
        message: "Order cannot be cancelled",
      });
    }

    order.orderStatus = "cancelled";
    order.cancelReason = reason || "";

    if (order.paymentMethod !== "cod" && order.paymentStatus === "paid") {
      await walletService.creditWallet(
        order.user,
        order.total,
        "Refund for cancelled order",
        order._id,
      );

      order.paymentStatus = "refunded";
    }

    for (const item of order.items) {
      if (item.variantId) {
        await ProductVariant.updateOne(
          { _id: item.variantId },
          { $inc: { stockQuantity: item.quantity } },
        );
        await updateProductStock(item.product);
      } else {
        await Product.updateOne(
          { _id: item.product },
          { $inc: { stock: item.quantity } },
        );
      }
      item.status = "cancelled";
      item.itemStatus = "cancelled";
    }

    if (
      (order.paymentMethod === "online" || order.paymentMethod === "wallet") &&
      order.paymentStatus === "paid"
    ) {
      await walletService.creditWallet(
        order.user,
        order.total,
        "Refund for cancelled order",
        order._id,
      );
    }

    await order.save();

    return res.json({
      success: true,
      message: "Order cancelled successfully",
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

exports.cancelItem = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }
    const item = order.items.id(req.params.itemId);
    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Item not found" });
    }
    // Update status fields
    item.status = "cancelled";
    item.itemStatus = "cancelled";
    item.cancelReason = req.body.reason || "";

    if (
      (order.paymentMethod === "online" || order.paymentMethod === "wallet") &&
      order.paymentStatus === "paid"
    ) {
      await walletService.creditWallet(
        order.user,
        item.finalPrice || item.total - (item.couponDiscount || 0),
        "Refund for cancelled item",
        order._id,
      );
    }
    // Restock inventory
    if (item.variantId) {
      await ProductVariant.updateOne(
        { _id: item.variantId },
        { $inc: { stockQuantity: item.quantity } },
      );
      await updateProductStock(item.product);
    } else {
      await Product.updateOne(
        { _id: item.product },
        { $inc: { stock: item.quantity } },
      );
    }
    // If all items cancelled, update overall order status
    const allCancelled = order.items.every(
      (i) => i.status === "cancelled" || i.itemStatus === "cancelled",
    );
    if (allCancelled) {
      order.orderStatus = "cancelled";
    }
    await order.save();
    return res.json({ success: true, message: "Item cancelled" });
  } catch (err) {
    console.error("CANCEL ITEM ERROR:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.returnOrder = async (req, res) => {
  try {
    const { reason } = req.body;

    const order = await Order.findById(req.params.id);

    console.log("Order Status:", order.orderStatus);
    console.log("Type:", typeof order.orderStatus);

    if (!order) {
      return res.redirect("/orders");
    }

    if (order.orderStatus?.toLowerCase().trim() !== "delivered") {
      req.flash("error", "Only delivered orders can be returned");
      return res.redirect(`/orders/${order._id}`);
    }

    order.orderStatus = "returnRequested";

    // mark every item as requested
    order.items.forEach((item) => {
      item.returnStatus = "requested";
      item.itemStatus = "returnRequested";
      item.returnReason = reason || "";
      item.returnRequestedAt = new Date();
    });

    await order.save();

    req.flash("success", "Return request submitted");
    return res.redirect("/orderhistory");
  } catch (err) {
    console.error("RETURN ORDER ERROR:", err);
    res.redirect("/orders");
  }
};

exports.returnItem = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const { reason } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    const item = order.items.id(itemId);
    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Item not found" });
    }

    item.returnStatus = "requested";
    item.itemStatus = "returnRequested";
    item.returnReason = reason;
    item.returnRequestedAt = new Date();

    await order.save();
    // Send JSON response for AJAX handling
    res.json({ success: true, message: "Return request submitted" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.submitReview = async (req, res) => {
  try {
    console.log("REVIEW BODY:", req.body);

    const { rating, comment } = req.body;
    const orderId = req.params.id;

    // save review

    res.json({
      success: true,
    });
  } catch (err) {
    console.error("REVIEW ERROR:", err);

    res.status(500).json({
      success: false,
      message: "Failed to submit review",
    });
  }
};

exports.downloadInvoice = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate("items.product");

    if (!order) {
      return res.redirect("/orders");
    }
    const activeItems = order.items.filter(
      (item) => item.itemStatus !== "cancelled",
    );

    const subtotal = activeItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    const discount = order.discount || 0;
    const shipping = order.shipping || 0;
    const tax = order.tax || 0;

    const total = subtotal + shipping + tax - discount;

    const activeItemCount = activeItems.length;

    // Render EJS to HTML
    res.render(
      "user/orders/invoice",
      { order, subtotal, total, activeItemCount },
      async (err, html) => {
        if (err) {
          console.error(err);
          return res.status(500).send("Invoice render error");
        }

        const browser = await puppeteer.launch({
          headless: true,
        });

        const page = await browser.newPage();

        await page.setContent(html, {
          waitUntil: "networkidle0",
        });

        const pdfBuffer = await page.pdf({
          format: "A4",
          printBackground: true,
        });

        await browser.close();

        res.set({
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename=invoice-${order.orderId}.pdf`,
        });

        res.send(pdfBuffer);
      },
    );
  } catch (err) {
    console.error(err);
    res.status(500).send("Invoice generation failed");
  }
};
