const React = require('react');

const CarmiContext = React.createContext(null);

class CarmiRoot extends React.Component {
  constructor(props) {
    super(props);
  }
  render() {
    return React.createElement(CarmiContext.Provider, {
      value: this.props.value,
      children: this.props.children()
    });
  }
  componentDidMount() {
    this.props.value.root = this;
    this.props.value.instance.$addListener(this.props.value.flush);
  }
  componentWillUnmount() {
    this.props.value.instance.$removeListener(this.props.value.flush);
  }
}

class CarmiObserver extends React.Component {
  constructor(props) {
    super(props);
    this.context = null;
  }
  render() {
    return React.createElement(CarmiContext.Consumer, {
      children: context => {
        this.context = context;
        let { type, props, children } = this.props.descriptor;
        props = { ...props };
        if (props.hasOwnProperty('style')) {
          props.style = { ...props.style };
        }
        if (!context.extraFuncLib.hasOwnProperty(type)) {
          return React.createElement.apply(React, [type, props].concat(children || []));
        } else {
          const cls = context.extraFuncLib[type];
          if (cls.prototype && cls.prototype.render) {
            return React.createElement.apply(React, [cls, props].concat(children || []));
          } else {
            return cls.apply(context.instance, [props].concat(children || []));
          }
        }
      }
    });
  }
  componentDidMount() {
    const context = this.context;
    if (!context.descriptorToCompsMap.has(this.props.descriptor)) {
      context.descriptorToCompsMap.set(this.props.descriptor, new Set());
    }
    context.descriptorToCompsMap.get(this.props.descriptor).add(this);
  }
  componentWillUnmount() {
    const context = this.context;
    if (!context.descriptorToCompsMap.has(this.props.descriptor)) {
      context.descriptorToCompsMap.set(this.props.descriptor, new Set());
    }
    context.descriptorToCompsMap.get(this.props.descriptor).delete(this);
  }
}

function init(extraFuncLib) {
  extraFuncLib = extraFuncLib || {};
  const descriptorToCompsMap = new WeakMap();
  const descriptorToElementsMap = new WeakMap();
  const bindArrToFunctions = new WeakMap();
  const pendingFlush = new Set();

  const context = {
    descriptorToCompsMap,
    descriptorToElementsMap,
    extraFuncLib,
    pendingFlush,
    bindArrToFunctions,
    root: null
  };

  function createElement(descriptor) {
    const { props } = descriptor;
    const key = props && props.key;
    if (context.root && context.descriptorToCompsMap.has(descriptor)) {
      pendingFlush.add(descriptor);
    }
    const newProps = { descriptor };
    if (key !== null) {
      newProps.key = key;
    }
    if (!context.descriptorToElementsMap.has(descriptor)) {
      const element = React.createElement(CarmiObserver, newProps);
      context.descriptorToElementsMap.set(descriptor, element);
    }
    return context.descriptorToElementsMap.get(descriptor);
  }

  function bind(args) {
    if (!context.bindArrToFunctions.has(args)) {
      context.bindArrToFunctions.set(args, function() {
        if (extraFuncLib.hasOwnProperty(args[0])) {
          extraFuncLib[args[0]].apply(null, [context.instance].concat(args.slice(1)));
        } else if (typeof context.instance[args[0]] === 'function') {
          context.instance[args[0]].apply(null, args.slice(1));
        }
      });
    }
    return context.bindArrToFunctions.get(args);
  }

  function flush(val) {
    let updateRoot = false;
    pendingFlush.forEach(element => {
      if (context.root) {
        const comps = descriptorToCompsMap.get(element);
        if (comps) {
          comps.forEach(comp => comp.forceUpdate(() => {}));
        }
      }
      updateRoot = true;
    });
    if (updateRoot) {
      context.root.forceUpdate(() => {});
    }

    pendingFlush.clear();
    return val;
  }

  const funcLib = {
    createElement,
    bind
  };

  function Provider({ children, instance }) {
    context.instance = instance;
    context.flush = flush;
    return React.createElement(CarmiRoot, { children, value: context });
  }

  return {
    funcLib,
    Provider
  };
}

module.exports = init;
